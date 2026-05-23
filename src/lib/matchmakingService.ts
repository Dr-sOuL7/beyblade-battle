import { supabase } from './supabase';
import { createActiveBattle, sendInitialBattleMessage } from './battleService';
import { sendMessage, editMessageText } from './telegram';
import { ensureUser } from './battleService';

export async function joinQueue(chatId: number, telegramId: number, username: string, messageIdToEdit?: number) {
  // Ensure user has an ELO
  const u1 = await ensureUser(telegramId, username);
  const userElo = u1?.elo || 1000;

  // Insert or update into queue
  await supabase.from('matchmaking_queue').upsert({
    telegram_id: telegramId,
    chat_id: chatId,
    username: username,
    elo: userElo,
    joined_at: new Date().toISOString()
  });

  const matched = await processQueue(telegramId);
  
  if (!matched) {
    // Send or edit queue message
    const { count } = await supabase.from('matchmaking_queue').select('*', { count: 'exact', head: true });
    
    const text = `🌀 <b>Entering Ranked Arena...</b>\n\n` +
      `<i>Searching for a worthy opponent...</i>\n\n` +
      `⚔️ ${count || 1} Bladers searching the arena...`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '↻ Refresh Search', callback_data: `refresh_queue` },
          { text: '❌ Cancel', callback_data: `cancel_queue` }
        ]
      ]
    };

    if (messageIdToEdit) {
      await editMessageText(chatId, messageIdToEdit, text, keyboard);
    } else {
      await sendMessage(chatId, text, keyboard);
    }
  }
}

export async function cancelQueue(chatId: number, telegramId: number, messageId: number) {
  await supabase.from('matchmaking_queue').delete().eq('telegram_id', telegramId);
  await editMessageText(chatId, messageId, `❌ Matchmaking cancelled.`, { inline_keyboard: [] });
}

export async function processQueue(triggerUserId: number) {
  // Fetch everyone in queue ordered by joined_at (longest waiting first)
  const { data: queue } = await supabase
    .from('matchmaking_queue')
    .select('*')
    .order('joined_at', { ascending: true });

  if (!queue || queue.length < 2) return false;

  const triggerUser = queue.find(q => q.telegram_id === triggerUserId);
  if (!triggerUser) return false;

  const now = Date.now();

  // Find a match for triggerUser
  const myWaitMs = now - new Date(triggerUser.joined_at).getTime();
  const myWaitSecs = Math.max(0, myWaitMs / 1000);
  // Base 200, +50 per 10s waiting, max 1000
  const myRange = Math.min(1000, 200 + Math.floor(myWaitSecs / 10) * 50);

  for (const opponent of queue) {
    if (opponent.telegram_id === triggerUser.telegram_id) continue;

    const oppWaitMs = now - new Date(opponent.joined_at).getTime();
    const oppWaitSecs = Math.max(0, oppWaitMs / 1000);
    const oppRange = Math.min(1000, 200 + Math.floor(oppWaitSecs / 10) * 50);

    const eloDiff = Math.abs(triggerUser.elo - opponent.elo);
    const maxAllowedRange = Math.max(myRange, oppRange);

    if (eloDiff <= maxAllowedRange) {
      // Check Anti-Farming: Did they just fight?
      const { data: recentBattles } = await supabase
        .from('battles')
        .select('id, created_at')
        .or(`and(player1_id.eq.${triggerUser.telegram_id},player2_id.eq.${opponent.telegram_id}),and(player1_id.eq.${opponent.telegram_id},player2_id.eq.${triggerUser.telegram_id})`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentBattles && recentBattles.length > 0) {
        // Prevent rematching if they fought in the last 15 minutes
        const lastBattleTime = new Date(recentBattles[0].created_at).getTime();
        if (now - lastBattleTime < 15 * 60 * 1000) {
          continue;
        }
      }

      // MATCH FOUND!
      // 1. Remove both from queue
      await supabase.from('matchmaking_queue').delete().in('telegram_id', [triggerUser.telegram_id, opponent.telegram_id]);

      // 2. Create Active Battle
      const battle = await createActiveBattle(
        { chatId: triggerUser.chat_id, telegramId: triggerUser.telegram_id, username: triggerUser.username },
        { chatId: opponent.chat_id, telegramId: opponent.telegram_id, username: opponent.username }
      );

      // 3. Send Battle Message
      await sendInitialBattleMessage(battle);

      // 4. Notify both players that a match was found (optional, since the battle message itself is sent)
      // They will just see the battle pop up.
      
      return true; // Match found
    }
  }

  return false;
}
