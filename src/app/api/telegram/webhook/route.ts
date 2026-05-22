import { NextResponse } from 'next/server';
// import { supabase } from '@/lib/supabase';
// import { resolveRound, PlayerState } from '@/lib/engine';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  const payload: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

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

      if (text.startsWith('/start')) {
        await sendMessage(chatId, "Welcome to <b>Beyblade Bot</b>! Use /fight to challenge others.");
      } else if (text.startsWith('/fight')) {
        await sendMessage(chatId, "Challenge issued! Waiting for opponent...\n<i>(Note: Full combat flow is being migrated to Supabase)</i>");
      }
      // Add more command handlers here...
    } 
    // Callback query handling (Inline buttons)
    else if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message?.chat.id;
      const data = callbackQuery.data;

      if (chatId) {
        await sendMessage(chatId, `Action received: ${data}`);
        
        // Acknowledge the callback query to remove loading state on the button
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackQuery.id }),
        });
      }
    }

    // Always return 200 OK to Telegram so it doesn't retry
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
