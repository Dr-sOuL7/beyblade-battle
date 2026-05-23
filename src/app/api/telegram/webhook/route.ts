import { NextResponse } from 'next/server';
import { sendMessage, answerCallbackQuery, getChallengeKeyboard, editMessageText } from '@/lib/telegram';
import { createBattle, acceptBattle, declineBattle, submitAction, setChallengeMessageId, sendInitialBattleMessage } from '@/lib/battleService';
import { Action } from '@/lib/engine';

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
        await sendMessage(chatId, "Welcome to <b>Beyblade Bot</b>! Use /fight to challenge others.");
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
