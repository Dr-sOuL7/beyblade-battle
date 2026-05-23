export type Action = "attack" | "defend" | "evade" | "special" | null;

export interface PlayerState {
  user_id: number;
  username: string;
  health: number;
  spin: number;
  charge: number;
  action: Action;
}

export interface RoundResult {
  p1_spin_loss: number;
  p2_spin_loss: number;
  p1_hp_loss: number;
  p2_hp_loss: number;
  p1_charge: number;
  p2_charge: number;
  p1_used_special: boolean;
  p2_used_special: boolean;
  winner: "p1" | "p2" | "draw" | null;
  p1_cause: string;
  p2_cause: string;
}

const COMBAT_TABLE: Record<string, [number, number, number, number, number, number]> = {
  "attack-attack": [15, 15, 10, 10, 5, 5],
  "attack-defend": [10, 5, 0, 5, 5, 15],
  "attack-evade": [5, 0, 0, 0, 0, 10],
  "defend-attack": [5, 10, 5, 0, 15, 5],
  "defend-defend": [0, 0, 0, 0, 0, 0],
  "defend-evade": [0, 0, 0, 0, 0, 0],
  "evade-attack": [0, 5, 0, 0, 10, 0],
  "evade-defend": [0, 0, 0, 0, 0, 0],
  "evade-evade": [0, 0, 0, 0, 0, 0],
};

const SPECIAL_DAMAGE: Record<string, number> = {
  attack: 20,
  defend: 15,
  evade: 10,
};

export function resolveRound(p1: PlayerState, p2: PlayerState): RoundResult {
  if (!p1.action || !p2.action) {
    throw new Error("Cannot resolve round: Both players must have an action.");
  }

  const raw_p1 = p1.action;
  const raw_p2 = p2.action;

  const eff_p1 = raw_p1 === "special" ? "attack" : raw_p1;
  const eff_p2 = raw_p2 === "special" ? "attack" : raw_p2;

  const key = `${eff_p1}-${eff_p2}`;
  let [p1_spin_loss, p2_spin_loss, p1_hp_loss, p2_hp_loss, p1_charge, p2_charge] = COMBAT_TABLE[key];

  if (raw_p1 === "special") {
    p2_hp_loss = SPECIAL_DAMAGE[eff_p2];
    p1.charge = 0;
  }

  if (raw_p2 === "special") {
    p1_hp_loss = SPECIAL_DAMAGE[eff_p1];
    p2.charge = 0;
  }

  p1.spin = Math.max(0, p1.spin - p1_spin_loss);
  p2.spin = Math.max(0, p2.spin - p2_spin_loss);
  p1.health = Math.max(0, p1.health - p1_hp_loss);
  p2.health = Math.max(0, p2.health - p2_hp_loss);
  p1.charge = Math.min(100, p1.charge + p1_charge);
  p2.charge = Math.min(100, p2.charge + p2_charge);

  const PASSIVE_SPIN = 5;
  p1.spin = Math.max(0, p1.spin - PASSIVE_SPIN);
  p2.spin = Math.max(0, p2.spin - PASSIVE_SPIN);
  p1_spin_loss += PASSIVE_SPIN;
  p2_spin_loss += PASSIVE_SPIN;

  const p1_dead = p1.health <= 0 || p1.spin <= 0;
  const p2_dead = p2.health <= 0 || p2.spin <= 0;

  let winner: "p1" | "p2" | "draw" | null = null;
  if (p1_dead && p2_dead) winner = "draw";
  else if (p1_dead) winner = "p2";
  else if (p2_dead) winner = "p1";

  const cause = (p: PlayerState) => {
    if (p.health <= 0 && p.spin <= 0) return "KO + Spin Over!";
    if (p.health <= 0) return "KO!";
    if (p.spin <= 0) return "Spin Over!";
    return "";
  };

  return {
    p1_spin_loss,
    p2_spin_loss,
    p1_hp_loss,
    p2_hp_loss,
    p1_charge,
    p2_charge,
    p1_used_special: raw_p1 === "special",
    p2_used_special: raw_p2 === "special",
    winner,
    p1_cause: cause(p1),
    p2_cause: cause(p2),
  };
}
