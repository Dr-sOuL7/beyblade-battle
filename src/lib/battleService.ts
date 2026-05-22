import { supabase } from './supabase';
import { resolveRound, PlayerState, Action } from './engine';
import { sendMessage, editMessageText, getBattleKeyboard, formatPlayerStats } from './telegram';

// Start a new battle
export async function createBattle(chatId: number, player1Id: number, player1Username: string) {
  // Ensure user exists
  await ensureUser(player1Id, player1Username);

  // Expire in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('battles')
    .insert({
      chat_id: chatId,
      status: 'pending',
      player1_id: player1Id,
      player1_username: player1Username,
      p1_hp: 100,
      p1_spin: 100,
      p1_charge: 0,
      p1_action: null,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating battle:', error);
    throw error;
  }
  return data;
}

// Join a pending battle
export async function joinBattle(battleId: string, player2Id: number, player2Username: string) {
  // Ensure user exists
  await ensureUser(player2Id, player2Username);

  const { data: battle, error: fetchError } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchError || !battle) return { error: 'Battle not found' };
  if (battle.status !== 'pending') return { error: 'Battle is no longer pending' };
  if (battle.player1_id === player2Id) return { error: 'You cannot fight yourself!' };

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('battles')
    .update({
      status: 'active',
      player2_id: player2Id,
      player2_username: player2Username,
      p2_hp: 100,
      p2_spin: 100,
      p2_charge: 0,
      p2_action: null,
      expires_at: expiresAt,
    })
    .eq('id', battleId)
    .select()
    .single();

  if (updateError) throw updateError;
  return { battle: updated };
}

// Submit an action for a player
export async function submitAction(battleId: string, playerId: number, action: Action) {
  // 1. Fetch battle
  const { data: battle, error: fetchError } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchError || !battle) return { error: 'Battle not found' };
  if (battle.status !== 'active') return { error: 'Battle is not active' };

  // 2. Validate player & check turn lock
  let isP1 = false;
  if (battle.player1_id === playerId) {
    isP1 = true;
    if (battle.p1_action) return { error: 'You already submitted your action!' };
  } else if (battle.player2_id === playerId) {
    isP1 = false;
    if (battle.p2_action) return { error: 'You already submitted your action!' };
  } else {
    return { error: 'You are not part of this battle!' };
  }

  // 3. Update the action
  const updatePayload: any = isP1 ? { p1_action: action } : { p2_action: action };
  // Extend expiration since there was activity
  updatePayload.expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: updatedBattle, error: updateError } = await supabase
    .from('battles')
    .update(updatePayload)
    .eq('id', battleId)
    .select()
    .single();

  if (updateError) throw updateError;

  // 4. Check if both actions are submitted
  if (updatedBattle.p1_action && updatedBattle.p2_action) {
    await resolveBattleRound(updatedBattle);
    return { status: 'round_resolved' };
  }

  return { status: 'waiting' };
}

// Resolves a round, updates DB and Telegram
async function resolveBattleRound(battle: any) {
  const p1: PlayerState = {
    user_id: battle.player1_id,
    username: battle.player1_username,
    health: battle.p1_hp,
    spin: battle.p1_spin,
    charge: battle.p1_charge,
    action: battle.p1_action,
  };

  const p2: PlayerState = {
    user_id: battle.player2_id,
    username: battle.player2_username,
    health: battle.p2_hp,
    spin: battle.p2_spin,
    charge: battle.p2_charge,
    action: battle.p2_action,
  };

  const result = resolveRound(p1, p2);

  // Create battle log
  let resultText = '';
  if (result.winner) {
    if (result.winner === 'draw') resultText = "It's a Draw! Both stopped simultaneously.";
    else {
      const winnerName = result.winner === 'p1' ? p1.username : p2.username;
      const cause = result.winner === 'p1' ? result.p2_cause : result.p1_cause;
      resultText = `${winnerName} wins! ${cause}`;
    }
  }

  await supabase.from('battle_logs').insert({
    battle_id: battle.id,
    round_number: battle.round_number,
    p1_action: battle.p1_action,
    p2_action: battle.p2_action,
    p1_hp_loss: result.p1_hp_loss,
    p2_hp_loss: result.p2_hp_loss,
    p1_spin_loss: result.p1_spin_loss,
    p2_spin_loss: result.p2_spin_loss,
    result_text: resultText,
  });

  // Update battle state
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  
  const updatePayload: any = {
    p1_hp: p1.health,
    p1_spin: p1.spin,
    p1_charge: p1.charge,
    p2_hp: p2.health,
    p2_spin: p2.spin,
    p2_charge: p2.charge,
    p1_action: null, // Reset for next round
    p2_action: null,
    round_number: battle.round_number + 1,
    expires_at: expiresAt,
  };

  if (result.winner) {
    updatePayload.status = 'finished';
    updatePayload.winner = result.winner;
    // Don't reset actions if finished so we can display them if needed
    updatePayload.p1_action = battle.p1_action;
    updatePayload.p2_action = battle.p2_action;
  }

  const { data: newBattle } = await supabase
    .from('battles')
    .update(updatePayload)
    .eq('id', battle.id)
    .select()
    .single();

  // If battle finished, update user stats
  if (result.winner && result.winner !== 'draw') {
    const winnerId = result.winner === 'p1' ? battle.player1_id : battle.player2_id;
    const loserId = result.winner === 'p1' ? battle.player2_id : battle.player1_id;
    
    // Call RPC or simple updates (simplified here)
    // NOTE: In production, use an RPC to safely increment
    await incrementWinLoss(winnerId, 'wins');
    await incrementWinLoss(loserId, 'losses');
  }

  // Update Telegram Message
  await updateBattleMessage(newBattle, battle.p1_action, battle.p2_action, resultText);
}

async function ensureUser(telegramId: number, username: string) {
  const { data } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single();
  if (!data) {
    await supabase.from('users').insert({
      telegram_id: telegramId,
      username: username,
    });
  }
}

async function incrementWinLoss(telegramId: number, field: 'wins' | 'losses') {
  const { data } = await supabase.from('users').select(field).eq('telegram_id', telegramId).single();
  if (data) {
    await supabase.from('users').update({ [field]: data[field] + 1 }).eq('telegram_id', telegramId);
  }
}

export async function setBattleMessageId(battleId: string, messageId: number) {
  await supabase.from('battles').update({ battle_message_id: messageId }).eq('id', battleId);
}

export async function setChallengeMessageId(battleId: string, messageId: number) {
  await supabase.from('battles').update({ challenge_message_id: messageId }).eq('id', battleId);
}

async function updateBattleMessage(battle: any, p1LastAction: string, p2LastAction: string, resultText: string) {
  if (!battle.battle_message_id) return;

  const p1Stats = formatPlayerStats(battle.player1_username, battle.p1_hp, battle.p1_spin, battle.p1_charge);
  const p2Stats = formatPlayerStats(battle.player2_username, battle.p2_hp, battle.p2_spin, battle.p2_charge);

  if (battle.status === 'finished') {
    const actionLabel = (act: string) => {
      const map: Record<string, string> = { attack: "Attack ⚔️", defend: "Defend 🛡️", evade: "Evade 💨", special: "Special ✨" };
      return map[act] || act;
    };

    const text = `⚔️ <b>Round ${battle.round_number - 1} — Final!</b>\n\n` +
      `@${battle.player1_username} chose: <b>${actionLabel(p1LastAction)}</b>\n` +
      `@${battle.player2_username} chose: <b>${actionLabel(p2LastAction)}</b>\n\n` +
      `🏆 <b>${resultText}</b>\n\n` +
      `<b>Final Stats:</b>\n${p1Stats}\n\n${p2Stats}`;

    await editMessageText(battle.chat_id, battle.battle_message_id, text, null);
  } else {
    const text = `⚔️ <b>Round ${battle.round_number}</b>\n\n` +
      `<i>Last Round: @${battle.player1_username} used ${p1LastAction}, @${battle.player2_username} used ${p2LastAction}</i>\n\n` +
      `${p1Stats}\n\n${p2Stats}\n\n` +
      `Choose your next action!`;

    await editMessageText(battle.chat_id, battle.battle_message_id, text, getBattleKeyboard(battle.id));
  }
}

export async function sendInitialBattleMessage(battle: any) {
  const p1Stats = formatPlayerStats(battle.player1_username, battle.p1_hp, battle.p1_spin, battle.p1_charge);
  const p2Stats = formatPlayerStats(battle.player2_username, battle.p2_hp, battle.p2_spin, battle.p2_charge);

  const text = `⚔️ <b>BATTLE START: Round 1</b>\n\n` +
    `@${battle.player1_username} vs @${battle.player2_username}\n\n` +
    `${p1Stats}\n\n${p2Stats}\n\n` +
    `Let it rip! Choose your action:`;

  const res = await sendMessage(battle.chat_id, text, getBattleKeyboard(battle.id));
  if (res && res.ok) {
    await setBattleMessageId(battle.id, res.result.message_id);
  }
}
