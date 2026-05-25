import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendMessage, answerCallbackQuery, getChallengeKeyboard, editMessageText } from '@/lib/telegram';
import { createBattle, acceptBattle, declineBattle, submitAction, setChallengeMessageId, sendInitialBattleMessage } from '@/lib/battleService';
import { Action } from '@/lib/engine';
import { joinQueue, cancelQueue as cancelMatchmakingQueue, processQueue } from '@/lib/matchmakingService';

function sanitizeIdentityInput(input: string, minLength: number, maxLength: number): string {
  let sanitized = input.replace(/<\/?[^>]+(>|$)/g, ""); // Strip HTML
  sanitized = sanitized.replace(/[\r\n]+/g, " "); // Prevent newlines
  sanitized = sanitized.trim();
  if (sanitized.length < minLength) return "";
  if (sanitized.length > maxLength) return sanitized.substring(0, maxLength);
  return sanitized;
}

const BOT_TOKEN = process.env.BOT_TOKEN || '';

export async function POST(req: Request) {
  if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is not set.");
    return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
  }

  try {
    const update = await req.json();

    // Command handling
    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text as string;
      const fromId = update.message.from.id;
      const fromUsername = update.message.from.username || update.message.from.first_name || "Unknown";

      if (text.startsWith('/start')) {
        await sendMessage(chatId, "Welcome to <b>Beyblade Bot</b>!\n\nUse <code>/guide</code> for a quick tutorial on how to play.\n\nUse <code>/fight</code> to challenge someone, or <code>/matchmake</code> to find a ranked opponent (and <code>/cancel</code> to stop searching).\n\nCustomize your identity with:\n<code>/setbey [Name]</code> (3-16 chars)");
      } else if (text.startsWith('/guide')) {
        const guideText = `📖 <b>Beyblade Bot Guide</b>\n\n` +
          `<b>How to Play:</b>\n` +
          `1️⃣ Use <code>/matchmake</code> to queue for a random battle, or reply to someone's message with <code>/fight</code> to challenge them.\n` +
          `2️⃣ In battle, you and your opponent choose an action secretly.\n` +
          `3️⃣ Once both choose, the round resolves! Reduce your opponent's HP or Spin to 0 to win.\n\n` +
          `<b>Combat Mechanics (v2):</b>\n` +
          `⚔️ <b>Attack:</b> High damage output, moderate spin cost, builds Special.\n` +
          `🛡️ <b>Defend:</b> Reduces incoming damage, lower spin cost, slower Special charge.\n` +
          `💨 <b>Evade:</b> Low self-damage, builds Special fast, but vulnerable to Special.\n` +
          `✨ <b>Special:</b> Unlocks at 100 SP. Devastating but costly — resets your meter!\n\n` +
          `<b>Key Stats:</b>\n` +
          `❤️ HP: 100 — Reach 0 = KO!\n` +
          `🌀 Spin: 100 — Reach 0 = Spin Over!\n` +
          `⚡ Special: Builds each round, usable at 100.`;
        await sendMessage(chatId, guideText);
      } else if (text.startsWith('/setbey ')) {
        const rawName = text.replace('/setbey ', '');
        const beyName = sanitizeIdentityInput(rawName, 3, 16);
        if (!beyName) {
           await sendMessage(chatId, "❌ Bey name must be 3-16 characters long and contain valid text.");
        } else {
           const { data } = await supabase.from('users').update({ bey_name: beyName, username: fromUsername }).eq('telegram_id', fromId).select();
           if (!data || data.length === 0) {
             await supabase.from('users').insert({ telegram_id: fromId, username: fromUsername, bey_name: beyName });
           }
           await sendMessage(chatId, `✅ Your Bey is now named: <b>${beyName}</b>`);
        }
      } else if (text.startsWith('/matchmake')) {
        await joinQueue(chatId, fromId, fromUsername);
      } else if (text.startsWith('/cancel')) {
        await cancelMatchmakingQueue(chatId, fromId, update.message.message_id);
      } else if (text.startsWith('/fight')) {
        const replyToMessage = update.message.reply_to_message;
        if (!replyToMessage) {
           await sendMessage(chatId, "You must reply to a user's message to challenge them!");
           return NextResponse.json({ ok: true });
        }
        
        const player2Id = replyToMessage.from.id;
        const player2Username = replyToMessage.from.username || replyToMessage.from.first_name || "Unknown";
        
        if (player2Id === fromId) {
           await sendMessage(chatId, "You cannot challenge yourself!");
           return NextResponse.json({ ok: true });
        }
        
        if (replyToMessage.from.is_bot) {
           await sendMessage(chatId, "You cannot challenge a bot!");
           return NextResponse.json({ ok: true });
        }

        try {
          const battle = await createBattle(chatId, fromId, fromUsername, player2Id, player2Username);
          const res = await sendMessage(chatId, `⚔️ @${fromUsername} challenges @${player2Username} to a battle!`, getChallengeKeyboard(battle.id));
          if (res && res.ok) {
            await setChallengeMessageId(battle.id, res.result.message_id);
          }
        } catch (error: any) {
          console.error("Failed to create battle:", error);
          const errorDetails = error.message || error.code || JSON.stringify(error);
          await sendMessage(chatId, `Failed to start a battle. Error: ${errorDetails}`);
        }
      }
    } 
    // Callback query handling (Inline buttons)
    else if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const data = callbackQuery.data;
      const fromId = callbackQuery.from.id;
      const fromUsername = callbackQuery.from.username || callbackQuery.from.first_name || "Unknown";

      if (data) {
        const parts = data.split(':');
        const actionType = parts[0];

        try {
          if (actionType === 'accept_battle' && parts[1]) {
            const battleId = parts[1];
            const result = await acceptBattle(battleId, fromId);
            
            if (result.error) {
              await answerCallbackQuery(callbackQuery.id, result.error, true);
            } else if (result.battle) {
              await answerCallbackQuery(callbackQuery.id, "You accepted the battle!");
              await editMessageText(callbackQuery.message.chat.id, callbackQuery.message.message_id, `⚔️ Challenge accepted!`, { inline_keyboard: [] });
              await sendInitialBattleMessage(result.battle);
            }
          } 
          else if (actionType === 'decline_battle' && parts[1]) {
            const battleId = parts[1];
            const result = await declineBattle(battleId, fromId);
            
            if (result.error) {
              await answerCallbackQuery(callbackQuery.id, result.error, true);
            } else {
              await answerCallbackQuery(callbackQuery.id, "You declined the battle.");
              await editMessageText(callbackQuery.message.chat.id, callbackQuery.message.message_id, `❌ Challenge declined.`, { inline_keyboard: [] });
            }
          }
          else if (actionType === 'action' && parts[1] && parts[2] && parts[3]) {
            const battleId = parts[1];
            const pKey = parts[2];
            const move = parts[3] as Action;
            
            const result = await submitAction(battleId, fromId, move, pKey);
            
            if (result.error) {
              await answerCallbackQuery(callbackQuery.id, result.error, true);
            } else {
              await answerCallbackQuery(callbackQuery.id, `Action queued: ${move}`);
            }
          } else if (actionType === 'disabled') {
            await answerCallbackQuery(callbackQuery.id, "⚡ Special not ready yet!", true);
          } else if (actionType === 'refresh_queue') {
            const matched = await processQueue(fromId);
            if (!matched) {
              const { count } = await supabase.from('matchmaking_queue').select('*', { count: 'exact', head: true });
              const text = `🌀 <b>Entering Ranked Arena...</b>\n\n` +
                `<i>Searching for a worthy opponent...</i>\n\n` +
                `⚔️ ${count || 1} Bladers searching the arena...`;
              const keyboard = { inline_keyboard: [[{ text: '↻ Refresh Search', callback_data: `refresh_queue` }, { text: '❌ Cancel', callback_data: `cancel_queue` }]] };
              await editMessageText(callbackQuery.message.chat.id, callbackQuery.message.message_id, text, keyboard);
              await answerCallbackQuery(callbackQuery.id, "Queue refreshed.");
            } else {
              await answerCallbackQuery(callbackQuery.id, "Match found!");
            }
          } else if (actionType === 'cancel_queue') {
            await cancelMatchmakingQueue(callbackQuery.message.chat.id, fromId, callbackQuery.message.message_id);
            await answerCallbackQuery(callbackQuery.id, "Matchmaking cancelled.");
          } else if (actionType === 'rematch' && parts[1]) {
            const battleId = parts[1];
            // Get original battle
            const { data: oldBattle } = await supabase.from('battles').select('*').eq('id', battleId).single();
            if (oldBattle) {
              const player2Id = oldBattle.player1_id === fromId ? oldBattle.player2_id : oldBattle.player1_id;
              const player2Username = oldBattle.player1_id === fromId ? oldBattle.player2_username : oldBattle.player1_username;
              
              const battle = await createBattle(callbackQuery.message.chat.id, fromId, fromUsername, player2Id, player2Username);
              const res = await sendMessage(callbackQuery.message.chat.id, `⚔️ @${fromUsername} demands a rematch against @${player2Username}!`, getChallengeKeyboard(battle.id));
              if (res && res.ok) {
                await setChallengeMessageId(battle.id, res.result.message_id);
              }
              await answerCallbackQuery(callbackQuery.id, "Rematch challenged!");
            } else {
              await answerCallbackQuery(callbackQuery.id, "Battle not found.", true);
            }
          } else {
            await answerCallbackQuery(callbackQuery.id);
          }
        } catch (err: any) {
          console.error("Error processing callback:", err);
          await answerCallbackQuery(callbackQuery.id, "An error occurred.", true);
        }
      } else {
        await answerCallbackQuery(callbackQuery.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
