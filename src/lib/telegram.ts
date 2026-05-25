import { INITIAL_HP, INITIAL_SPIN, MAX_SPECIAL, SPECIAL_THRESHOLD } from './combatMatrix';
import { RoundResult } from './engine';

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
    const specialBtn = charge >= SPECIAL_THRESHOLD 
      ? { text: '✨ Special', callback_data: `action:${battle.id}:${pKey}:special` }
      : { text: `🔒 ${charge}/${MAX_SPECIAL}`, callback_data: `disabled` };

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

  const hpBar = createBar(hp, INITIAL_HP, hp <= 25 ? '🟥' : '🟩', '⬛', 5);
  const spinBar = createBar(spin, INITIAL_SPIN, '🟦', '⬛', 5);
  const chargeBar = createBar(charge, MAX_SPECIAL, '🟨', '⬛', 5);

  let hpText = `${hpBar} ${hp}/${INITIAL_HP}`;
  if (hp <= 25 && hp > 0) hpText += ` 🩸`;

  let spinText = `${spinBar} ${spin}/${INITIAL_SPIN}`;
  if (spin <= 25 && spin > 0) spinText += ` ⚠️`;

  let spReady = `${chargeBar} ${charge}/${MAX_SPECIAL}`;
  if (charge >= SPECIAL_THRESHOLD) spReady += ' 🔥';
  
  return `👤 <b>${username}</b>\n` +
         `❤️ <b>HP:</b> ${hpText}\n` +
         `🌀 <b>Spin:</b> ${spinText}\n` +
         `⚡ <b>SP:</b> ${spReady}`;
}

const ACTION_LABELS: Record<string, string> = {
  attack: 'ATTACK',
  defend: 'DEFEND',
  evade: 'EVADE',
  special: 'SPECIAL',
};

/**
 * Formats the structured round result message for Telegram.
 * Shows exact damage, spin loss, special gain, and current status for both players.
 */
export function formatRoundResult(
  p1Username: string,
  p2Username: string,
  p1Action: string,
  p2Action: string,
  result: RoundResult,
  roundNumber: number,
): string {
  const p1Label = ACTION_LABELS[p1Action] || p1Action.toUpperCase();
  const p2Label = ACTION_LABELS[p2Action] || p2Action.toUpperCase();

  let text = `⚔️ <b>ROUND ${roundNumber}</b>\n\n`;
  text += `${p1Username} used <b>${p1Label}</b>\n`;
  text += `${p2Username} used <b>${p2Label}</b>\n`;

  // --- P1 damage/effects ---
  const p1Lines: string[] = [];
  if (result.p1_hp_loss > 0) p1Lines.push(`💥 ${p1Username} took ${result.p1_hp_loss} HP damage`);
  if (result.p1_spin_loss > 0) p1Lines.push(`🌀 ${p1Username} lost ${result.p1_spin_loss} Spin`);
  if (result.p1_used_special) {
    p1Lines.push(`✨ ${p1Username} unleashed SPECIAL! Meter reset to 0`);
  } else if (result.p1_special_delta > 0) {
    p1Lines.push(`⚡ ${p1Username} gained ${result.p1_special_delta} Special`);
  }

  // --- P2 damage/effects ---
  const p2Lines: string[] = [];
  if (result.p2_hp_loss > 0) p2Lines.push(`💥 ${p2Username} took ${result.p2_hp_loss} HP damage`);
  if (result.p2_spin_loss > 0) p2Lines.push(`🌀 ${p2Username} lost ${result.p2_spin_loss} Spin`);
  if (result.p2_used_special) {
    p2Lines.push(`✨ ${p2Username} unleashed SPECIAL! Meter reset to 0`);
  } else if (result.p2_special_delta > 0) {
    p2Lines.push(`⚡ ${p2Username} gained ${result.p2_special_delta} Special`);
  }

  const effectLines = [...p1Lines, ...p2Lines];
  if (effectLines.length > 0) {
    text += `\n${effectLines.join('\n')}\n`;
  }

  // --- Current Status ---
  text += `\n<b>Current Status:</b>\n`;
  text += `\n👤 <b>${p1Username}</b>\n`;
  text += `❤️ HP: ${result.p1_hp_after}\n`;
  text += `🌀 Spin: ${result.p1_spin_after}\n`;
  text += `⚡ Special: ${result.p1_special_after}/${MAX_SPECIAL}\n`;

  text += `\n👤 <b>${p2Username}</b>\n`;
  text += `❤️ HP: ${result.p2_hp_after}\n`;
  text += `🌀 Spin: ${result.p2_spin_after}\n`;
  text += `⚡ Special: ${result.p2_special_after}/${MAX_SPECIAL}`;

  return text;
}
