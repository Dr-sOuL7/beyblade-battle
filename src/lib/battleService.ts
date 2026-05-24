import { supabase } from './supabase';
import { resolveRound, PlayerState, Action } from './engine';
import { sendMessage, editMessageText, getBattleKeyboard, formatPlayerStats } from './telegram';
import { getRoundNarration } from './narration';
import { calculateEloChange, getRankDetails } from './ranking';

// Start a new battle
export async function createBattle(chatId: number, player1Id: number, player1Username: string, player2Id: number, player2Username: string) {
  // Ensure users exist and fetch identity
  const u1 = await ensureUser(player1Id, player1Username);
  const u2 = await ensureUser(player2Id, player2Username);

  // Expire in 10 minutes
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('battles')
    .insert({
      chat_id: chatId,
      status: 'pending',
      player1_id: player1Id,
      player1_username: player1Username,
      player2_id: player2Id,
      player2_username: player2Username,
      p1_title: u1?.title || 'Rookie',
      p1_bey_name: u1?.bey_name || 'Default Bey',
      p2_title: u2?.title || 'Rookie',
      p2_bey_name: u2?.bey_name || 'Default Bey',
      p1_hp: 100,
      p1_spin: 200,
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

// Create an instantly active battle from Matchmaking
export async function createActiveBattle(p1: any, p2: any) {
  const u1 = await ensureUser(p1.telegramId, p1.username);
  const u2 = await ensureUser(p2.telegramId, p2.username);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('battles')
    .insert({
      chat_id: p1.chatId,
      chat_id_2: p2.chatId,
      status: 'active',
      player1_id: p1.telegramId,
      player1_username: p1.username,
      player2_id: p2.telegramId,
      player2_username: p2.username,
      p1_title: u1?.title || 'Rookie',
      p1_bey_name: u1?.bey_name || 'Default Bey',
      p2_title: u2?.title || 'Rookie',
      p2_bey_name: u2?.bey_name || 'Default Bey',
      p1_hp: 100,
      p1_spin: 200,
      p1_charge: 0,
      p2_hp: 100,
      p2_spin: 200,
      p2_charge: 0,
      p1_action: null,
      p2_action: null,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Accept a pending battle
export async function acceptBattle(battleId: string, player2Id: number) {
  const { data: battle, error: fetchError } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchError || !battle) return { error: 'Battle not found' };
  if (battle.status !== 'pending') return { error: 'Battle is no longer pending' };
  if (battle.player2_id !== player2Id) return { error: 'You are not the challenged player!' };

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('battles')
    .update({
      status: 'active',
      p2_hp: 100,
      p2_spin: 200,
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

// Decline a pending battle
export async function declineBattle(battleId: string, player2Id: number) {
  const { data: battle, error: fetchError } = await supabase
    .from('battles')
    .select('*')
    .eq('id', battleId)
    .single();

  if (fetchError || !battle) return { error: 'Battle not found' };
  if (battle.status !== 'pending') return { error: 'Battle is no longer pending' };
  if (battle.player2_id !== player2Id) return { error: 'You are not the challenged player!' };

  const { error: updateError } = await supabase
    .from('battles')
    .update({ status: 'declined' })
    .eq('id', battleId);

  if (updateError) throw updateError;
  return { success: true };
}

// Submit an action for a player
export async function submitAction(battleId: string, playerId: number, action: Action, pKey: string) {
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
  let charge = 0;
  if (pKey === 'p1') {
    if (battle.player1_id !== playerId) return { error: 'These are not your buttons!' };
    isP1 = true;
    charge = battle.p1_charge;
    if (battle.p1_action) return { error: 'You already submitted your action!' };
  } else if (pKey === 'p2') {
    if (battle.player2_id !== playerId) return { error: 'These are not your buttons!' };
    isP1 = false;
    charge = battle.p2_charge;
    if (battle.p2_action) return { error: 'You already submitted your action!' };
  } else {
    return { error: 'Invalid button key!' };
  }

  const currentCharge = Number(charge) || 0;
  if (action === 'special' && currentCharge < 100) {
    return { error: `⚡ Special not ready yet! Charge: ${currentCharge}/100` };
  }

  // 3. Update the action atomically
  const actionColumn = isP1 ? 'p1_action' : 'p2_action';
  const updatePayload: any = isP1 ? { p1_action: action } : { p2_action: action };
  // Extend expiration since there was activity
  updatePayload.expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: updatedBattle, error: updateError } = await supabase
    .from('battles')
    .update(updatePayload)
    .eq('id', battleId)
    .is(actionColumn, null)
    .select()
    .maybeSingle();

  if (updateError) throw updateError;
  
  if (!updatedBattle) {
    return { error: 'Action already submitted or battle is no longer active!' };
  }

  // 4. Check if both actions are submitted
  if (updatedBattle.p1_action && updatedBattle.p2_action) {
    await resolveBattleRound(updatedBattle);
    return { status: 'round_resolved' };
  }

  await updateWaitingMessage(updatedBattle);

  return { status: 'waiting' };
}

// Resolves a round, updates DB and Telegram
async function resolveBattleRound(battle: any) {
  // Explicit invariant validation
  if (!battle.player1_id || !battle.player2_id) return;
  if (!battle.p1_action || !battle.p2_action) return;
  if (battle.status !== 'active') return;
  if (battle.winner) return;

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

  const newP1Hp = Math.max(0, p1.health - result.p1_hp_loss);
  const newP2Hp = Math.max(0, p2.health - result.p2_hp_loss);
  const newP1Spin = Math.max(0, p1.spin - result.p1_spin_loss);
  const newP2Spin = Math.max(0, p2.spin - result.p2_spin_loss);

  const isClimax = battle.round_number >= 5 || newP1Hp <= 30 || newP2Hp <= 30;
  let resultText = getRoundNarration(p1.username, p2.username, battle.p1_action, battle.p2_action, isClimax);
  let highlights = battle.highlights || [];

  if (result.p1_hp_loss >= 15 && result.p2_hp_loss >= 15) {
    resultText += `\n\n💥 <b>PERFECT CLASH!</b> A massive shockwave ripples through the arena!`;
    if (!highlights.includes('perfect_clash')) highlights.push('perfect_clash');
  }

  if (!result.winner && ((newP1Hp > 0 && newP1Hp <= 5) || (newP2Hp > 0 && newP2Hp <= 5) || (newP1Spin > 0 && newP1Spin <= 5) || (newP2Spin > 0 && newP2Spin <= 5))) {
    resultText += `\n\n💫 <b>MIRACLE SURVIVAL!</b> Hanging on by a thread!`;
    if (!highlights.includes('miracle_survival')) highlights.push('miracle_survival');
  }

  // Create battle log
  if (result.winner) {
    if (result.winner === 'draw') {
      resultText += "\n\n🔥💥 <b>MUTUAL DESTRUCTION! Both bladers fall simultaneously!</b>";
      if (!highlights.includes('simultaneous_ko')) highlights.push('simultaneous_ko');
    }
    else {
      const winnerName = result.winner === 'p1' ? p1.username : p2.username;
      const cause = result.winner === 'p1' ? result.p2_cause : result.p1_cause;
      resultText += `\n\n🏆 <b>${winnerName} wins! ${cause}</b>`;
    }

    // --- Ranking & ELO Integration ---
    const { data: u1 } = await supabase.from('users').select('*').eq('telegram_id', battle.player1_id).single();
    const { data: u2 } = await supabase.from('users').select('*').eq('telegram_id', battle.player2_id).single();

    if (u1 && u2) {
      const p1OldRank = getRankDetails(u1.elo, u1.total_battles);
      const p2OldRank = getRankDetails(u2.elo, u2.total_battles);

      const eloChange = calculateEloChange(u1.elo, u2.elo, result.winner);
      
      const updateU1 = {
        total_battles: u1.total_battles + 1,
        elo: eloChange.newP1Elo,
        wins: result.winner === 'p1' ? u1.wins + 1 : u1.wins,
        losses: result.winner === 'p2' ? u1.losses + 1 : u1.losses,
        win_streak: result.winner === 'p1' ? u1.win_streak + 1 : (result.winner === 'p2' ? 0 : u1.win_streak),
        highest_win_streak: Math.max(u1.highest_win_streak, result.winner === 'p1' ? u1.win_streak + 1 : u1.win_streak),
      };

      const updateU2 = {
        total_battles: u2.total_battles + 1,
        elo: eloChange.newP2Elo,
        wins: result.winner === 'p2' ? u2.wins + 1 : u2.wins,
        losses: result.winner === 'p1' ? u2.losses + 1 : u2.losses,
        win_streak: result.winner === 'p2' ? u2.win_streak + 1 : (result.winner === 'p1' ? 0 : u2.win_streak),
        highest_win_streak: Math.max(u2.highest_win_streak, result.winner === 'p2' ? u2.win_streak + 1 : u2.win_streak),
      };

      await supabase.from('users').update(updateU1).eq('telegram_id', u1.telegram_id);
      await supabase.from('users').update(updateU2).eq('telegram_id', u2.telegram_id);

      const p1NewRank = getRankDetails(updateU1.elo, updateU1.total_battles);
      const p2NewRank = getRankDetails(updateU2.elo, updateU2.total_battles);

      const p1Promoted = p1OldRank.name !== p1NewRank.name && updateU1.total_battles >= 5 && result.winner === 'p1';
      const p2Promoted = p2OldRank.name !== p2NewRank.name && updateU2.total_battles >= 5 && result.winner === 'p2';

      resultText += `\n\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 <b>Rank Updates:</b>\n` +
        `${p1NewRank.emoji} @${p1.username}: ${eloChange.p1Delta > 0 ? '+' : ''}${eloChange.p1Delta} ELO\n` +
        `${p2NewRank.emoji} @${p2.username}: ${eloChange.p2Delta > 0 ? '+' : ''}${eloChange.p2Delta} ELO`;

      if (p1Promoted) resultText += `\n\n🏆 <b>@${p1.username}</b> RANK UP! You are now a <b>${p1NewRank.name}</b>!`;
      if (p2Promoted) resultText += `\n\n🏆 <b>@${p2.username}</b> RANK UP! You are now a <b>${p2NewRank.name}</b>!`;
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
    status: result.winner ? 'finished' : 'active',
    p1_hp: newP1Hp,
    p2_hp: newP2Hp,
    p1_spin: newP1Spin,
    p2_spin: newP2Spin,
    p1_charge: p1.charge,
    p2_charge: p2.charge,
    round_number: battle.round_number + 1,
    p1_action: null,
    p2_action: null,
    expires_at: expiresAt,
    highlights: highlights
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
    .eq('round_number', battle.round_number) // Optimistic lock
    .select()
    .maybeSingle();

  if (!newBattle) {
    // 0 rows updated, meaning another request already resolved this round
    return;
  }

  // Update Telegram Message
  await updateBattleMessage(newBattle, battle.p1_action, battle.p2_action, resultText);
}

export async function ensureUser(telegramId: number, username: string) {
  const { data, error } = await supabase.from('users').select('*').eq('telegram_id', telegramId).maybeSingle();
  if (!data) {
    const { data: newUser } = await supabase.from('users').insert({
      telegram_id: telegramId,
      username: username,
    }).select().single();
    return newUser;
  }
  return data;
}

// Note: incrementWinLoss is removed as ranking handles it directly.

export async function setBattleMessageId(battleId: string, messageId: number, messageId2?: number) {
  const payload: any = { battle_message_id: messageId };
  if (messageId2) payload.battle_message_id_2 = messageId2;
  await supabase.from('battles').update(payload).eq('id', battleId);
}

export async function setChallengeMessageId(battleId: string, messageId: number) {
  await supabase.from('battles').update({ challenge_message_id: messageId }).eq('id', battleId);
}

async function updateWaitingMessage(battle: any) {
  if (!battle.battle_message_id) return;

  const p1Stats = formatPlayerStats(battle.player1_username, battle.p1_hp, battle.p1_spin, battle.p1_charge);
  const p2Stats = formatPlayerStats(battle.player2_username, battle.p2_hp, battle.p2_spin, battle.p2_charge);
  const divider = (battle.round_number >= 5 || battle.p1_hp <= 30 || battle.p2_hp <= 30) 
                  ? `🔥🔥━━━━━ ⚔️ ━━━━━🔥🔥` 
                  : `━━━━━━━━━ ⚔️ ━━━━━━━━━`;

  const p1Status = battle.p1_action ? "🔒 <b>Locked In</b>" : "🤔 <i>Thinking...</i>";
  const p2Status = battle.p2_action ? "🔒 <b>Locked In</b>" : "🤔 <i>Thinking...</i>";

  const text = `${divider}\n` +
    `<b>Round ${battle.round_number}</b>\n\n` +
    `<i>Waiting for combatants...</i>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `${p1Stats}\n└ Status: ${p1Status}\n\n${p2Stats}\n└ Status: ${p2Status}\n\n` +
    `👉 <b>Choose your next action!</b>`;

  const keyboard = getBattleKeyboard(battle);
  await editMessageText(battle.chat_id, battle.battle_message_id, text, keyboard);
  if (battle.chat_id_2 && battle.battle_message_id_2) {
    await editMessageText(battle.chat_id_2, battle.battle_message_id_2, text, keyboard);
  }
}

async function updateBattleMessage(battle: any, p1LastAction: string, p2LastAction: string, resultText: string) {
  if (!battle.battle_message_id) return;

  const p1Stats = formatPlayerStats(battle.player1_username, battle.p1_hp, battle.p1_spin, battle.p1_charge);
  const p2Stats = formatPlayerStats(battle.player2_username, battle.p2_hp, battle.p2_spin, battle.p2_charge);
  const divider = (battle.round_number >= 5 || battle.p1_hp <= 30 || battle.p2_hp <= 30) 
                  ? `🔥🔥━━━━━ ⚔️ ━━━━━🔥🔥` 
                  : `━━━━━━━━━ ⚔️ ━━━━━━━━━`;

  if (battle.status === 'finished') {
    const text = `${divider}\n` +
      `<b>Round ${battle.round_number - 1} — Final!</b>\n\n` +
      `${resultText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Final Stats:</b>\n\n${p1Stats}\n\n${p2Stats}`;

    const keyboard = { inline_keyboard: [[{ text: '🔁 Demand Rematch', callback_data: `rematch:${battle.id}` }]] };
    await editMessageText(battle.chat_id, battle.battle_message_id, text, keyboard);
    if (battle.chat_id_2 && battle.battle_message_id_2) {
      await editMessageText(battle.chat_id_2, battle.battle_message_id_2, text, keyboard);
    }
  } else {
    const text = `${divider}\n` +
      `<b>Round ${battle.round_number}</b>\n\n` +
      `<i>${resultText}</i>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `${p1Stats}\n└ Status: 🤔 <i>Thinking...</i>\n\n${p2Stats}\n└ Status: 🤔 <i>Thinking...</i>\n\n` +
      `👉 <b>Choose your next action!</b>`;

    const keyboard = getBattleKeyboard(battle);
    await editMessageText(battle.chat_id, battle.battle_message_id, text, keyboard);
    if (battle.chat_id_2 && battle.battle_message_id_2) {
      await editMessageText(battle.chat_id_2, battle.battle_message_id_2, text, keyboard);
    }
  }
}

export async function sendInitialBattleMessage(battle: any) {
  const p1Stats = formatPlayerStats(battle.player1_username, battle.p1_hp, battle.p1_spin, battle.p1_charge);
  const p2Stats = formatPlayerStats(battle.player2_username, battle.p2_hp, battle.p2_spin, battle.p2_charge);

  const p1Title = battle.p1_title || 'Rookie';
  const p2Title = battle.p2_title || 'Rookie';
  const p1Bey = battle.p1_bey_name || 'Default Bey';
  const p2Bey = battle.p2_bey_name || 'Default Bey';

  // Fetch streak tension
  const { data: u1 } = await supabase.from('users').select('win_streak').eq('telegram_id', battle.player1_id).single();
  const { data: u2 } = await supabase.from('users').select('win_streak').eq('telegram_id', battle.player2_id).single();
  
  const p1Streak = u1 && u1.win_streak >= 5 ? `\n🔥 <b>ON A ${u1.win_streak}-WIN STREAK!</b>` : '';
  const p2Streak = u2 && u2.win_streak >= 5 ? `\n🔥 <b>ON A ${u2.win_streak}-WIN STREAK!</b>` : '';

  const text = `━━━━━━━━━ ⚔️ ━━━━━━━━━\n` +
    `<b>BATTLE START: Round 1</b>\n\n` +
    `⚔️ [${p1Title}] <b>@${battle.player1_username}</b> enters the arena!${p1Streak}\n` +
    `🌀 Bey: <i>${p1Bey}</i>\n\n` +
    `⚔️ [${p2Title}] <b>@${battle.player2_username}</b> enters the arena!${p2Streak}\n` +
    `🌀 Bey: <i>${p2Bey}</i>\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `${p1Stats}\n└ Status: 🤔 <i>Thinking...</i>\n\n${p2Stats}\n└ Status: 🤔 <i>Thinking...</i>\n\n` +
    `👉 <b>Let it rip! Choose your action:</b>`;

  const keyboard = getBattleKeyboard(battle);
  const res = await sendMessage(battle.chat_id, text, keyboard);
  
  let msgId2;
  if (battle.chat_id_2) {
    const res2 = await sendMessage(battle.chat_id_2, text, keyboard);
    if (res2 && res2.ok) msgId2 = res2.result.message_id;
  }

  if (res && res.ok) {
    await setBattleMessageId(battle.id, res.result.message_id, msgId2);
  }
}
