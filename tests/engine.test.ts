import { describe, it, expect } from 'vitest';
import { resolveRound, PlayerState } from '../src/lib/engine';
import { INITIAL_HP, INITIAL_SPIN, INITIAL_SPECIAL, MAX_SPECIAL } from '../src/lib/combatMatrix';

describe('Engine v2: Deterministic Combat Matrix', () => {

  const createPlayer = (id: number, action: any, charge = INITIAL_SPECIAL, hp = INITIAL_HP, spin = INITIAL_SPIN): PlayerState => ({
    user_id: id,
    username: `Player${id}`,
    health: hp,
    spin: spin,
    charge,
    action,
  });

  // ============================================================
  // Test all 16 matrix entries for exact values
  // ============================================================

  const matrixTests: {
    name: string;
    p1Action: string;
    p2Action: string;
    p1Charge?: number;
    p2Charge?: number;
    expected: {
      p1HpLoss: number; p2HpLoss: number;
      p1SpinLoss: number; p2SpinLoss: number;
      p1Special: number; p2Special: number;
    };
  }[] = [
    { name: 'ATTACK vs ATTACK',  p1Action: 'attack',  p2Action: 'attack',  expected: { p1HpLoss: 17, p2HpLoss: 17, p1SpinLoss: 13, p2SpinLoss: 13, p1Special: 11, p2Special: 11 }},
    { name: 'ATTACK vs DEFEND',  p1Action: 'attack',  p2Action: 'defend',  expected: { p1HpLoss: 8,  p2HpLoss: 6,  p1SpinLoss: 11, p2SpinLoss: 9,  p1Special: 11, p2Special: 6  }},
    { name: 'ATTACK vs EVADE',   p1Action: 'attack',  p2Action: 'evade',   expected: { p1HpLoss: 6,  p2HpLoss: 11, p1SpinLoss: 8,  p2SpinLoss: 10, p1Special: 11, p2Special: 12 }},
    { name: 'ATTACK vs SPECIAL', p1Action: 'attack',  p2Action: 'special', p2Charge: 100, expected: { p1HpLoss: 27, p2HpLoss: 18, p1SpinLoss: 17, p2SpinLoss: 13, p1Special: 11, p2Special: 0  }},
    { name: 'DEFEND vs ATTACK',  p1Action: 'defend',  p2Action: 'attack',  expected: { p1HpLoss: 6,  p2HpLoss: 8,  p1SpinLoss: 9,  p2SpinLoss: 11, p1Special: 6,  p2Special: 11 }},
    { name: 'DEFEND vs DEFEND',  p1Action: 'defend',  p2Action: 'defend',  expected: { p1HpLoss: 4,  p2HpLoss: 4,  p1SpinLoss: 6,  p2SpinLoss: 6,  p1Special: 6,  p2Special: 6  }},
    { name: 'DEFEND vs EVADE',   p1Action: 'defend',  p2Action: 'evade',   expected: { p1HpLoss: 5,  p2HpLoss: 5,  p1SpinLoss: 7,  p2SpinLoss: 6,  p1Special: 6,  p2Special: 12 }},
    { name: 'DEFEND vs SPECIAL', p1Action: 'defend',  p2Action: 'special', p2Charge: 100, expected: { p1HpLoss: 18, p2HpLoss: 21, p1SpinLoss: 14, p2SpinLoss: 15, p1Special: 6,  p2Special: 0  }},
    { name: 'EVADE vs ATTACK',   p1Action: 'evade',   p2Action: 'attack',  expected: { p1HpLoss: 11, p2HpLoss: 6,  p1SpinLoss: 10, p2SpinLoss: 8,  p1Special: 12, p2Special: 11 }},
    { name: 'EVADE vs DEFEND',   p1Action: 'evade',   p2Action: 'defend',  expected: { p1HpLoss: 5,  p2HpLoss: 5,  p1SpinLoss: 6,  p2SpinLoss: 7,  p1Special: 12, p2Special: 6  }},
    { name: 'EVADE vs EVADE',    p1Action: 'evade',   p2Action: 'evade',   expected: { p1HpLoss: 3,  p2HpLoss: 3,  p1SpinLoss: 5,  p2SpinLoss: 5,  p1Special: 12, p2Special: 12 }},
    { name: 'EVADE vs SPECIAL',  p1Action: 'evade',   p2Action: 'special', p2Charge: 100, expected: { p1HpLoss: 21, p2HpLoss: 17, p1SpinLoss: 15, p2SpinLoss: 11, p1Special: 12, p2Special: 0  }},
    { name: 'SPECIAL vs ATTACK', p1Action: 'special', p2Action: 'attack',  p1Charge: 100, expected: { p1HpLoss: 18, p2HpLoss: 27, p1SpinLoss: 13, p2SpinLoss: 17, p1Special: 0,  p2Special: 11 }},
    { name: 'SPECIAL vs DEFEND', p1Action: 'special', p2Action: 'defend',  p1Charge: 100, expected: { p1HpLoss: 21, p2HpLoss: 18, p1SpinLoss: 15, p2SpinLoss: 14, p1Special: 0,  p2Special: 6  }},
    { name: 'SPECIAL vs EVADE',  p1Action: 'special', p2Action: 'evade',   p1Charge: 100, expected: { p1HpLoss: 17, p2HpLoss: 21, p1SpinLoss: 11, p2SpinLoss: 15, p1Special: 0,  p2Special: 12 }},
    { name: 'SPECIAL vs SPECIAL',p1Action: 'special', p2Action: 'special', p1Charge: 100, p2Charge: 100, expected: { p1HpLoss: 25, p2HpLoss: 25, p1SpinLoss: 17, p2SpinLoss: 17, p1Special: 0,  p2Special: 0  }},
  ];

  matrixTests.forEach(({ name, p1Action, p2Action, p1Charge, p2Charge, expected }) => {
    it(`matrix: ${name}`, () => {
      const p1 = createPlayer(1, p1Action, p1Charge ?? 0);
      const p2 = createPlayer(2, p2Action, p2Charge ?? 0);
      const result = resolveRound(p1, p2);

      expect(result.p1_hp_loss).toBe(expected.p1HpLoss);
      expect(result.p2_hp_loss).toBe(expected.p2HpLoss);
      expect(result.p1_spin_loss).toBe(expected.p1SpinLoss);
      expect(result.p2_spin_loss).toBe(expected.p2SpinLoss);
      expect(result.p1_special_delta).toBe(expected.p1Special);
      expect(result.p2_special_delta).toBe(expected.p2Special);
    });
  });

  // ============================================================
  // Pure function: no mutation
  // ============================================================

  it('resolveRound does NOT mutate player state', () => {
    const p1 = createPlayer(1, 'attack');
    const p2 = createPlayer(2, 'defend');
    const originalP1 = { ...p1 };
    const originalP2 = { ...p2 };

    resolveRound(p1, p2);

    expect(p1.health).toBe(originalP1.health);
    expect(p1.spin).toBe(originalP1.spin);
    expect(p1.charge).toBe(originalP1.charge);
    expect(p2.health).toBe(originalP2.health);
    expect(p2.spin).toBe(originalP2.spin);
    expect(p2.charge).toBe(originalP2.charge);
  });

  // ============================================================
  // After-state computation
  // ============================================================

  it('computes correct after-state for HP, Spin, and Special', () => {
    const p1 = createPlayer(1, 'attack', 50);
    const p2 = createPlayer(2, 'defend', 30);
    const result = resolveRound(p1, p2);

    // Attack vs Defend: P1 loses 8 HP, 11 Spin, gains 11 SP. P2 loses 6 HP, 9 Spin, gains 6 SP.
    expect(result.p1_hp_after).toBe(INITIAL_HP - 8);    // 92
    expect(result.p1_spin_after).toBe(INITIAL_SPIN - 11); // 89
    expect(result.p1_special_after).toBe(50 + 11);       // 61

    expect(result.p2_hp_after).toBe(INITIAL_HP - 6);    // 94
    expect(result.p2_spin_after).toBe(INITIAL_SPIN - 9); // 91
    expect(result.p2_special_after).toBe(30 + 6);       // 36
  });

  // ============================================================
  // Special meter behavior
  // ============================================================

  it('special resets meter to 0 after use', () => {
    const p1 = createPlayer(1, 'special', 100);
    const p2 = createPlayer(2, 'attack', 50);
    const result = resolveRound(p1, p2);

    expect(result.p1_used_special).toBe(true);
    expect(result.p1_special_after).toBe(0);
    expect(result.p1_special_delta).toBe(0);
    
    expect(result.p2_used_special).toBe(false);
    expect(result.p2_special_after).toBe(50 + 11); // 61
    expect(result.p2_special_delta).toBe(11);
  });

  it('special meter clamps at MAX_SPECIAL (100)', () => {
    // Evade gives 12 special. Start at 95 → should clamp to 100.
    const p1 = createPlayer(1, 'evade', 95);
    const p2 = createPlayer(2, 'evade', 95);
    const result = resolveRound(p1, p2);

    expect(result.p1_special_after).toBe(MAX_SPECIAL); // 100, not 107
    expect(result.p2_special_after).toBe(MAX_SPECIAL);
  });

  it('special meter cannot go below 0', () => {
    // Special vs Special: both reset to 0
    const p1 = createPlayer(1, 'special', 100);
    const p2 = createPlayer(2, 'special', 100);
    const result = resolveRound(p1, p2);

    expect(result.p1_special_after).toBe(0);
    expect(result.p2_special_after).toBe(0);
  });

  // ============================================================
  // Clamping
  // ============================================================

  it('HP clamps to minimum 0', () => {
    const p1 = createPlayer(1, 'attack', 0, 5, INITIAL_SPIN);  // 5 HP, will lose 17
    const p2 = createPlayer(2, 'attack', 0, INITIAL_HP, INITIAL_SPIN);
    const result = resolveRound(p1, p2);

    expect(result.p1_hp_after).toBe(0);
    expect(result.winner).toBe('p2');
    expect(result.p1_cause).toBe('KO!');
  });

  it('Spin clamps to minimum 0', () => {
    const p1 = createPlayer(1, 'attack', 0, INITIAL_HP, 5); // 5 Spin, will lose 13
    const p2 = createPlayer(2, 'attack', 0, INITIAL_HP, INITIAL_SPIN);
    const result = resolveRound(p1, p2);

    expect(result.p1_spin_after).toBe(0);
    expect(result.winner).toBe('p2');
    expect(result.p1_cause).toBe('Spin Over!');
  });

  // ============================================================
  // Winner determination
  // ============================================================

  it('declares draw when both players die simultaneously', () => {
    const p1 = createPlayer(1, 'attack', 0, 10, INITIAL_SPIN);
    const p2 = createPlayer(2, 'attack', 0, 10, INITIAL_SPIN);
    const result = resolveRound(p1, p2);

    // Both lose 17 HP from 10 → 0
    expect(result.winner).toBe('draw');
  });

  it('determines KO + Spin Over cause correctly', () => {
    const p1 = createPlayer(1, 'attack', 0, 5, 5); // Both will hit 0
    const p2 = createPlayer(2, 'attack', 0, INITIAL_HP, INITIAL_SPIN);
    const result = resolveRound(p1, p2);

    expect(result.p1_hp_after).toBe(0);
    expect(result.p1_spin_after).toBe(0);
    expect(result.p1_cause).toBe('KO + Spin Over!');
  });

  it('returns null winner when both survive', () => {
    const p1 = createPlayer(1, 'defend');
    const p2 = createPlayer(2, 'defend');
    const result = resolveRound(p1, p2);

    expect(result.winner).toBeNull();
    expect(result.p1_cause).toBe('');
    expect(result.p2_cause).toBe('');
  });

  // ============================================================
  // Error handling
  // ============================================================

  it('throws when actions are null', () => {
    const p1 = createPlayer(1, null);
    const p2 = createPlayer(2, 'attack');

    expect(() => resolveRound(p1, p2)).toThrow('Both players must have an action');
  });

  // ============================================================
  // Symmetry validation (matrix is NOT symmetric by design)
  // ============================================================

  it('attack-defend is correctly asymmetric to defend-attack', () => {
    const r1 = resolveRound(createPlayer(1, 'attack'), createPlayer(2, 'defend'));
    const r2 = resolveRound(createPlayer(1, 'defend'), createPlayer(2, 'attack'));

    // attack-defend: P1 loses 8 HP, P2 loses 6 HP
    // defend-attack: P1 loses 6 HP, P2 loses 8 HP (swapped)
    expect(r1.p1_hp_loss).toBe(r2.p2_hp_loss);
    expect(r1.p2_hp_loss).toBe(r2.p1_hp_loss);
    expect(r1.p1_spin_loss).toBe(r2.p2_spin_loss);
    expect(r1.p2_spin_loss).toBe(r2.p1_spin_loss);
  });
});
