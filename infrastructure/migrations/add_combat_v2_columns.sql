-- infrastructure/migrations/add_combat_v2_columns.sql
--
-- V2 Combat Matrix Migration
-- Extends battle_logs with special-move deltas and post-round state snapshots.
-- Tags battles with a combat_version and adds a telemetry JSONB blob for analytics.

-- ============================================================
-- 1. battle_logs — special-move deltas
-- ============================================================
ALTER TABLE battle_logs ADD COLUMN IF NOT EXISTS p1_special_delta INT DEFAULT 0;
ALTER TABLE battle_logs ADD COLUMN IF NOT EXISTS p2_special_delta INT DEFAULT 0;

-- ============================================================
-- 2. battle_logs — post-round state snapshots
-- ============================================================
ALTER TABLE battle_logs ADD COLUMN IF NOT EXISTS p1_hp_after INT;
ALTER TABLE battle_logs ADD COLUMN IF NOT EXISTS p2_hp_after INT;
ALTER TABLE battle_logs ADD COLUMN IF NOT EXISTS p1_spin_after INT;
ALTER TABLE battle_logs ADD COLUMN IF NOT EXISTS p2_spin_after INT;
ALTER TABLE battle_logs ADD COLUMN IF NOT EXISTS p1_special_after INT;
ALTER TABLE battle_logs ADD COLUMN IF NOT EXISTS p2_special_after INT;

-- ============================================================
-- 3. battles — combat version tag
-- ============================================================
ALTER TABLE battles ADD COLUMN IF NOT EXISTS combat_version TEXT DEFAULT 'v2';

-- ============================================================
-- 4. battles — telemetry blob for analytics
-- ============================================================
ALTER TABLE battles ADD COLUMN IF NOT EXISTS telemetry JSONB DEFAULT '{}';
