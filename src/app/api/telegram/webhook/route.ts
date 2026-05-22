import { NextResponse } from 'next/server';
import { sendMessage, answerCallbackQuery, getJoinKeyboard } from '@/lib/telegram';
import { createBattle, joinBattle, submitAction, setChallengeMessageId, sendInitialBattleMessage } from '@/lib/battleService';
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
        try {
          const battle = await createBattle(chatId, fromId, fromUsername);
          const res = await sendMessage(chatId, `⚔️ @${fromUsername} is looking for a battle!`, getJoinKeyboard(battle.id));
          if (res && res.ok) {
            await setChallengeMessageId(battle.id, res.result.message_id);
          }
        } catch (error: any) {
          console.error("Failed to create battle:", error);
          await sendMessage(chatId, "Failed to start a battle. Make sure database is configured.");
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
          if (actionType === 'join_battle' && parts[1]) {
            const battleId = parts[1];
            const result = await joinBattle(battleId, fromId, fromUsername);
            
            if (result.error) {
              await answerCallbackQuery(callbackQuery.id, result.error, true);
            } else if (result.battle) {
              await answerCallbackQuery(callbackQuery.id, "You joined the battle!");
              await sendInitialBattleMessage(result.battle);
            }
          } 
          else if (actionType === 'action' && parts[1] && parts[2]) {
            const battleId = parts[1];
            const move = parts[2] as Action;
            
            const result = await submitAction(battleId, fromId, move);
            
            if (result.error) {
              await answerCallbackQuery(callbackQuery.id, result.error, true);
            } else {
              await answerCallbackQuery(callbackQuery.id, `Action queued: ${move}`);
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
