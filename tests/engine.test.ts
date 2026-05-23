import { describe, it, expect } from 'vitest';
import { resolveRound, PlayerState } from '../src/lib/engine';

describe('Engine: Gameplay Regression Testing', () => {

  const createPlayer = (id: number, action: any, charge = 0): PlayerState => ({
    user_id: id,
    username: `Player${id}`,
    health: 100,
    spin: 200,
    charge,
    action,
  });

  it('attack beats defend (guard break)', () => {
    const p1 = createPlayer(1, 'attack');
    const p2 = createPlayer(2, 'defend');
    const result = resolveRound(p1, p2);
    
    expect(result.p1_hp_loss).toBe(0);
    expect(result.p1_spin_loss).toBe(15);
    expect(result.p2_hp_loss).toBe(5);
    expect(result.p2_spin_loss).toBe(10);
  });

  it('defend beats evade (perfect block)', () => {
    const p1 = createPlayer(1, 'defend');
    const p2 = createPlayer(2, 'evade');
    const result = resolveRound(p1, p2);
    
    expect(result.p1_hp_loss).toBe(0);
    expect(result.p1_spin_loss).toBe(5);
    expect(result.p2_hp_loss).toBe(0);
    expect(result.p2_spin_loss).toBe(5);
  });

  it('evade beats attack (dodge & counter)', () => {
    const p1 = createPlayer(1, 'evade');
    const p2 = createPlayer(2, 'attack');
    const result = resolveRound(p1, p2);
    
    expect(result.p1_hp_loss).toBe(0);
    expect(result.p1_spin_loss).toBe(5);
    expect(result.p2_hp_loss).toBe(0);
    expect(result.p2_spin_loss).toBe(10);
  });

  it('clashes (attack vs attack)', () => {
    const p1 = createPlayer(1, 'attack');
    const p2 = createPlayer(2, 'attack');
    const result = resolveRound(p1, p2);
    
    expect(result.p1_hp_loss).toBe(10);
    expect(result.p1_spin_loss).toBe(20);
    expect(result.p2_hp_loss).toBe(10);
    expect(result.p2_spin_loss).toBe(20);
  });

  it('special beats everything (special vs attack)', () => {
    const p1 = createPlayer(1, 'special', 100);
    const p2 = createPlayer(2, 'attack');
    const result = resolveRound(p1, p2);
    
    expect(result.p1_hp_loss).toBe(10);
    expect(result.p2_hp_loss).toBe(20);
  });

  it('spin initialization and loss behavior', () => {
    const p1 = createPlayer(1, 'evade');
    p1.spin = 4; // Will lose 5 passive spin -> 0
    const p2 = createPlayer(2, 'defend');
    
    const result = resolveRound(p1, p2);
    expect(result.winner).toBe('p2');
    expect(result.p1_cause).toBe('Spin Over!');
  });
  
  it('hp initialization and loss behavior', () => {
    const p1 = createPlayer(1, 'attack');
    p1.health = 5; // Will lose 10 hp in clash
    const p2 = createPlayer(2, 'attack');
    
    const result = resolveRound(p1, p2);
    expect(result.winner).toBe('p2');
    expect(result.p1_cause).toBe('KO!');
  });

});
