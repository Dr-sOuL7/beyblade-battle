const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  const payload: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function editMessageText(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  const payload: any = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' };
  if (replyMarkup !== undefined) {
    payload.reply_markup = replyMarkup; // Can be null to remove keyboard
  }
  
  const res = await fetch(`${TELEGRAM_API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert?: boolean) {
  const payload: any = { callback_query_id: callbackQueryId };
  if (text) {
    payload.text = text;
    payload.show_alert = showAlert || false;
  }
  
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getBattleKeyboard(battle: any) {
  const getRow = (pKey: string, charge: number) => {
    const specialBtn = charge >= 100 
      ? { text: '✨ Special', callback_data: `action:${battle.id}:${pKey}:special` }
      : { text: `🔒 ${charge}/100`, callback_data: `disabled` };

    return [
      { text: `⚔️ Attack`, callback_data: `action:${battle.id}:${pKey}:attack` },
      { text: `🛡️ Defend`, callback_data: `action:${battle.id}:${pKey}:defend` },
      { text: `💨 Evade`, callback_data: `action:${battle.id}:${pKey}:evade` },
      specialBtn
    ];
  };

  return {
    inline_keyboard: [
      getRow('p1', battle.p1_charge),
      getRow('p2', battle.p2_charge)
    ]
  };
}

export function getChallengeKeyboard(battleId: string) {
  return {
    inline_keyboard: [
      [
        { text: 'Accept ✅', callback_data: `accept_battle:${battleId}` },
        { text: 'Decline ❌', callback_data: `decline_battle:${battleId}` }
      ]
    ]
  };
}

export function formatPlayerStats(username: string, hp: number, spin: number, charge: number) {
  const createBar = (current: number, max: number, fullChar: string, emptyChar: string, segments: number = 5) => {
    const ratio = Math.max(0, Math.min(1, current / max));
    const fullCount = Math.round(ratio * segments);
    const emptyCount = segments - fullCount;
    return `[${fullChar.repeat(fullCount)}${emptyChar.repeat(emptyCount)}]`;
  };

  const hpBar = createBar(hp, 100, hp <= 25 ? '🟥' : '🟩', '⬛', 5);
  const spinBar = createBar(spin, 200, '🟦', '⬛', 5);
  const chargeBar = createBar(charge, 100, '🟨', '⬛', 5);

  let hpText = `${hpBar} ${hp}/100`;
  if (hp <= 25 && hp > 0) hpText += ` 🩸`;

  let spinText = `${spinBar} ${spin}/200`;
  if (spin <= 50 && spin > 0) spinText += ` ⚠️`;

  let spReady = `${chargeBar} ${charge}/100`;
  if (charge >= 100) spReady += ' 🔥';
  
  return `👤 <b>${username}</b>\n` +
         `❤️ <b>HP:</b> ${hpText}\n` +
         `🌀 <b>Spin:</b> ${spinText}\n` +
         `⚡ <b>SP:</b> ${spReady}`;
}
