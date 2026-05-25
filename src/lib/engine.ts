import { getMatrixEntry, CombatAction, SPECIAL_THRESHOLD, MAX_SPECIAL } from './combatMatrix';

// Re-export CombatAction for backwards compatibility
export type Action = CombatAction | null;

export interface PlayerState {
  user_id: number;
  username: string;
  health: number;
  spin: number;
  charge: number;
  action: Action;
}

export interface RoundResult {
  // Deltas (always positive — represent amount lost/gained)
  p1_hp_loss: number;
  p2_hp_loss: number;
  p1_spin_loss: number;
  p2_spin_loss: number;
  p1_special_delta: number;
  p2_special_delta: number;

  // Flags
  p1_used_special: boolean;
  p2_used_special: boolean;

  // Resulting state after applying deltas
  p1_hp_after: number;
  p2_hp_after: number;
  p1_spin_after: number;
  p2_spin_after: number;
  p1_special_after: number;
  p2_special_after: number;

  // Outcome
  winner: 'p1' | 'p2' | 'draw' | null;
  p1_cause: string;
  p2_cause: string;
}

/**
 * Resolves a single round of combat using the deterministic combat matrix.
 *
 * This is a PURE FUNCTION — it does NOT mutate p1 or p2.
 * All state changes are returned in the RoundResult.
 */
export function resolveRound(p1: PlayerState, p2: PlayerState): RoundResult {
  if (!p1.action || !p2.action) {
    throw new Error('Cannot resolve round: Both players must have an action.');
  }

  const p1Action = p1.action as CombatAction;
  const p2Action = p2.action as CombatAction;

  // Look up the exact outcome from the matrix
  const matrix = getMatrixEntry(p1Action, p2Action);

  // Extract deltas
  const p1_hp_loss = matrix.p1HpLoss;
  const p2_hp_loss = matrix.p2HpLoss;
  const p1_spin_loss = matrix.p1SpinLoss;
  const p2_spin_loss = matrix.p2SpinLoss;

  const p1_used_special = p1Action === 'special';
  const p2_used_special = p2Action === 'special';

  // Compute special meter changes
  // If SPECIAL was used: meter resets to 0 (delta is the negative of current charge)
  // Otherwise: gain the matrix value, clamped to MAX_SPECIAL
  let p1_special_after: number;
  let p2_special_after: number;
  let p1_special_delta: number;
  let p2_special_delta: number;

  if (p1_used_special) {
    p1_special_after = 0;
    p1_special_delta = 0; // Reset — the "gain" from matrix is 0 for special rows
  } else {
    p1_special_after = Math.min(MAX_SPECIAL, Math.max(0, p1.charge + matrix.p1Special));
    p1_special_delta = matrix.p1Special;
  }

  if (p2_used_special) {
    p2_special_after = 0;
    p2_special_delta = 0;
  } else {
    p2_special_after = Math.min(MAX_SPECIAL, Math.max(0, p2.charge + matrix.p2Special));
    p2_special_delta = matrix.p2Special;
  }

  // Compute resulting HP and Spin (clamped to minimum 0)
  const p1_hp_after = Math.max(0, p1.health - p1_hp_loss);
  const p2_hp_after = Math.max(0, p2.health - p2_hp_loss);
  const p1_spin_after = Math.max(0, p1.spin - p1_spin_loss);
  const p2_spin_after = Math.max(0, p2.spin - p2_spin_loss);

  // Determine winner
  const p1_dead = p1_hp_after <= 0 || p1_spin_after <= 0;
  const p2_dead = p2_hp_after <= 0 || p2_spin_after <= 0;

  let winner: 'p1' | 'p2' | 'draw' | null = null;
  if (p1_dead && p2_dead) winner = 'draw';
  else if (p1_dead) winner = 'p2';
  else if (p2_dead) winner = 'p1';

  const cause = (hp: number, spin: number): string => {
    if (hp <= 0 && spin <= 0) return 'KO + Spin Over!';
    if (hp <= 0) return 'KO!';
    if (spin <= 0) return 'Spin Over!';
    return '';
  };

  return {
    p1_hp_loss,
    p2_hp_loss,
    p1_spin_loss,
    p2_spin_loss,
    p1_special_delta,
    p2_special_delta,
    p1_used_special,
    p2_used_special,
    p1_hp_after,
    p2_hp_after,
    p1_spin_after,
    p2_spin_after,
    p1_special_after,
    p2_special_after,
    winner,
    p1_cause: cause(p1_hp_after, p1_spin_after),
    p2_cause: cause(p2_hp_after, p2_spin_after),
  };
}
