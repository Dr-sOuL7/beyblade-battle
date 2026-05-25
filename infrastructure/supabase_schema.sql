-- Database Architecture Backup
-- Run this in Supabase SQL Editor if you ever need to recreate the database
-- Updated: v2 combat matrix, ranking, matchmaking, identity columns

-- 1. Drop existing tables if doing a complete reset
-- DROP TABLE IF EXISTS matchmaking_queue CASCADE;
-- DROP TABLE IF EXISTS battle_logs CASCADE;
-- DROP TABLE IF EXISTS battles CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- 2. Create Users Table
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    score INT DEFAULT 0,

    -- Ranking / competitive fields  (migration: 02_ranking.sql)
    elo INT DEFAULT 1000,
    total_battles INT DEFAULT 0,
    win_streak INT DEFAULT 0,
    highest_win_streak INT DEFAULT 0,

    -- Identity fields  (migration: 01_identity.sql)
    title TEXT DEFAULT 'Rookie',
    bey_name TEXT DEFAULT 'Default Bey',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. Create Battles Table
-- ============================================================
CREATE TABLE battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    chat_id_2 BIGINT,                                  -- second chat for cross-group matchmaking
    -- Note: 'declined' was added recently to support the decline battle feature
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'finished', 'declined')),
    round_number INT DEFAULT 1,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    player1_id BIGINT REFERENCES users(telegram_id),
    player2_id BIGINT REFERENCES users(telegram_id),
    player1_username TEXT,
    player2_username TEXT,
    p1_hp INT,
    p2_hp INT,
    p1_spin INT,                                       -- initial spin (default 100)
    p2_spin INT,                                       -- initial spin (default 100)
    p1_charge INT,
    p2_charge INT,
    p1_action TEXT,
    p2_action TEXT,
    winner TEXT,
    battle_message_id BIGINT,
    battle_message_id_2 BIGINT,                        -- message id in the second chat
    challenge_message_id BIGINT,

    -- Identity snapshot  (migration: 01_identity.sql)
    p1_title TEXT,
    p1_bey_name TEXT,
    p2_title TEXT,
    p2_bey_name TEXT,

    -- Spectacle highlights  (migration: 01_identity.sql)
    highlights JSONB DEFAULT '[]',

    -- V2 combat metadata  (migration: add_combat_v2_columns.sql)
    combat_version TEXT DEFAULT 'v2',
    telemetry JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. Create Battle Logs (History) Table
-- ============================================================
CREATE TABLE battle_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    p1_action TEXT,
    p2_action TEXT,
    p1_hp_loss INT,
    p2_hp_loss INT,
    p1_spin_loss INT,
    p2_spin_loss INT,
    result_text TEXT,

    -- V2 combat columns  (migration: add_combat_v2_columns.sql)
    p1_special_delta INT DEFAULT 0,
    p2_special_delta INT DEFAULT 0,
    p1_hp_after INT,
    p2_hp_after INT,
    p1_spin_after INT,
    p2_spin_after INT,
    p1_special_after INT,
    p2_special_after INT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. Updated_at Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_battles_updated_at
    BEFORE UPDATE ON battles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. Unique Constraint on Battle Logs (Make them replay-safe)
-- ============================================================
ALTER TABLE battle_logs ADD CONSTRAINT unique_battle_round UNIQUE(battle_id, round_number);

-- ============================================================
-- 7. Matchmaking Queue  (migration: 03_matchmaking.sql)
-- ============================================================
CREATE TABLE matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    username TEXT,
    chat_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 8. Timeout Enforcement (pg_cron)
-- ============================================================
-- Note: requires pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'battle-timeout',
    '* * * * *', -- Run every minute
    $$
    UPDATE battles 
    SET status = CASE 
        WHEN status = 'pending' THEN 'declined'
        WHEN status = 'active' THEN 'finished'
    END
    WHERE expires_at <= NOW() AND status IN ('pending', 'active');
    $$
);
