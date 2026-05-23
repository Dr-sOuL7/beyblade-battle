import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '../src/lib/supabase';
import { createBattle, acceptBattle, submitAction } from '../src/lib/battleService';

describe('Integration: Concurrency, Idempotency, and Integrity', () => {

  const testChatId = 123456789;
  const p1Id = 111;
  const p2Id = 222;

  let battleId: string;

  beforeAll(async () => {
    // We create a fresh battle before tests
    const battle = await createBattle(testChatId, p1Id, 'TestP1', p2Id, 'TestP2');
    battleId = battle.id;
    await acceptBattle(battleId, p2Id);
  });

  afterAll(async () => {
    // Cleanup the battle
    if (battleId) {
      await supabase.from('battles').delete().eq('id', battleId);
    }
  });

  it('verifies duplicate webhook retries remain harmless (Idempotency)', async () => {
    // Player 1 submits an action
    const res1 = await submitAction(battleId, p1Id, 'attack', 'p1');
    expect(res1.status).toBe('waiting');

    // Webhook retries the exact same action for P1
    const res2 = await submitAction(battleId, p1Id, 'attack', 'p1');
    // Because of idempotency guards, it should return an error
    expect(res2.error).toMatch(/You already submitted your action!|Action already submitted/);

    // Confirm it didn't mutate state improperly
    const { data: battle } = await supabase.from('battles').select('*').eq('id', battleId).single();
    expect(battle.p1_action).toBe('attack');
  });

  it('verifies simultaneous action submissions prevent double-resolution (Concurrency)', async () => {
    // Currently P1 is 'attack'. P2 has not submitted. 
    // We will clear P1 action to start a fresh simultaneous test.
    await supabase.from('battles').update({ p1_action: null }).eq('id', battleId);

    // Simulate P1 and P2 submitting at exactly the same time, along with duplicate webhooks!
    const promises = [
      submitAction(battleId, p1Id, 'attack', 'p1'), // P1 normal
      submitAction(battleId, p1Id, 'defend', 'p1'), // P1 duplicate late webhook with different action
      submitAction(battleId, p2Id, 'defend', 'p2'), // P2 normal
      submitAction(battleId, p2Id, 'defend', 'p2'), // P2 duplicate webhook
    ];

    const results = await Promise.all(promises);

    // Only exactly ONE of these calls should have returned 'round_resolved'
    const resolvedCount = results.filter(r => r.status === 'round_resolved').length;
    expect(resolvedCount).toBe(1);

    // After resolution, the round number should have advanced from 1 to 2
    const { data: battle } = await supabase.from('battles').select('*').eq('id', battleId).single();
    expect(battle.round_number).toBe(2);
    // Actions should be cleared for the next round
    expect(battle.p1_action).toBeNull();
    expect(battle.p2_action).toBeNull();
  });

  it('verifies duplicate round logs cannot occur (Replay Integrity)', async () => {
    // Note: This test is skipped because the unique constraint needs to be manually 
    // applied by the user in the Supabase SQL editor using the infrastructure/supabase_schema.sql file.
    
    // The previous test resolved round 1. A log for round 1 should exist.
    const { data: logs } = await supabase.from('battle_logs').select('*').eq('battle_id', battleId).eq('round_number', 1);
    expect(logs).toHaveLength(1);

    // Try to manually insert another log for round 1
    const { error } = await supabase.from('battle_logs').insert({
      battle_id: battleId,
      round_number: 1, // Duplicate round number
      p1_action: 'attack',
      p2_action: 'defend'
    });

    // We expect a unique constraint violation error from Postgres
    expect(error).not.toBeNull();
    expect(error?.code).toBe('23505'); // PostgreSQL unique_violation error code
  });

});
