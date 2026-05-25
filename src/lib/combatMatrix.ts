// ============================================================
// Combat Matrix v2 — Deterministic PvP Balance Table
// ============================================================
// This matrix was derived from extensive simulation testing.
// Do NOT modify these values unless future telemetry from
// real players justifies further balancing.
// ============================================================

export const COMBAT_VERSION = 'v2';

// --- Game Constants ---
export const INITIAL_HP = 100;
export const INITIAL_SPIN = 100;
export const INITIAL_SPECIAL = 0;
export const SPECIAL_THRESHOLD = 100;
export const MAX_SPECIAL = 100;

// --- Types ---
export type CombatAction = 'attack' | 'defend' | 'evade' | 'special';

export interface MatrixEntry {
  p1HpLoss: number;
  p2HpLoss: number;
  p1SpinLoss: number;
  p2SpinLoss: number;
  p1Special: number;
  p2Special: number;
}

// --- Combat Matrix ---
// Key format: "P1ACTION-P2ACTION" (lowercase)
// All values are exact per-round deltas.
const COMBAT_MATRIX: Record<string, MatrixEntry> = {
  // ATTACK vs ...
  'attack-attack':  { p1HpLoss: 17, p2HpLoss: 17, p1SpinLoss: 13, p2SpinLoss: 13, p1Special: 11, p2Special: 11 },
  'attack-defend':  { p1HpLoss: 8,  p2HpLoss: 6,  p1SpinLoss: 11, p2SpinLoss: 9,  p1Special: 11, p2Special: 6  },
  'attack-evade':   { p1HpLoss: 6,  p2HpLoss: 11, p1SpinLoss: 8,  p2SpinLoss: 10, p1Special: 11, p2Special: 12 },
  'attack-special': { p1HpLoss: 27, p2HpLoss: 18, p1SpinLoss: 17, p2SpinLoss: 13, p1Special: 11, p2Special: 0  },

  // DEFEND vs ...
  'defend-attack':  { p1HpLoss: 6,  p2HpLoss: 8,  p1SpinLoss: 9,  p2SpinLoss: 11, p1Special: 6,  p2Special: 11 },
  'defend-defend':  { p1HpLoss: 4,  p2HpLoss: 4,  p1SpinLoss: 6,  p2SpinLoss: 6,  p1Special: 6,  p2Special: 6  },
  'defend-evade':   { p1HpLoss: 5,  p2HpLoss: 5,  p1SpinLoss: 7,  p2SpinLoss: 6,  p1Special: 6,  p2Special: 12 },
  'defend-special': { p1HpLoss: 18, p2HpLoss: 21, p1SpinLoss: 14, p2SpinLoss: 15, p1Special: 6,  p2Special: 0  },

  // EVADE vs ...
  'evade-attack':   { p1HpLoss: 11, p2HpLoss: 6,  p1SpinLoss: 10, p2SpinLoss: 8,  p1Special: 12, p2Special: 11 },
  'evade-defend':   { p1HpLoss: 5,  p2HpLoss: 5,  p1SpinLoss: 6,  p2SpinLoss: 7,  p1Special: 12, p2Special: 6  },
  'evade-evade':    { p1HpLoss: 3,  p2HpLoss: 3,  p1SpinLoss: 5,  p2SpinLoss: 5,  p1Special: 12, p2Special: 12 },
  'evade-special':  { p1HpLoss: 21, p2HpLoss: 17, p1SpinLoss: 15, p2SpinLoss: 11, p1Special: 12, p2Special: 0  },

  // SPECIAL vs ...
  'special-attack': { p1HpLoss: 18, p2HpLoss: 27, p1SpinLoss: 13, p2SpinLoss: 17, p1Special: 0,  p2Special: 11 },
  'special-defend': { p1HpLoss: 21, p2HpLoss: 18, p1SpinLoss: 15, p2SpinLoss: 14, p1Special: 0,  p2Special: 6  },
  'special-evade':  { p1HpLoss: 17, p2HpLoss: 21, p1SpinLoss: 11, p2SpinLoss: 15, p1Special: 0,  p2Special: 12 },
  'special-special': { p1HpLoss: 25, p2HpLoss: 25, p1SpinLoss: 17, p2SpinLoss: 17, p1Special: 0,  p2Special: 0  },
};

/**
 * Look up the exact combat outcome for a given action pair.
 * @throws Error if the action pair is not found in the matrix.
 */
export function getMatrixEntry(p1Action: CombatAction, p2Action: CombatAction): MatrixEntry {
  const key = `${p1Action}-${p2Action}`;
  const entry = COMBAT_MATRIX[key];
  if (!entry) {
    throw new Error(`Invalid combat matrix key: "${key}". Both actions must be one of: attack, defend, evade, special.`);
  }
  return entry;
}
