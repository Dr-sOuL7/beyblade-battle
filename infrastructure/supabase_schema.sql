-- Database Architecture Backup
-- Run this in Supabase SQL Editor if you ever need to recreate the database

-- 1. Drop existing tables if doing a complete reset
-- DROP TABLE IF EXISTS battle_logs CASCADE;
-- DROP TABLE IF EXISTS battles CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- 2. Create Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    score INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Battles Table
CREATE TABLE battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
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
    p1_spin INT,
    p2_spin INT,
    p1_charge INT,
    p2_charge INT,
    p1_action TEXT,
    p2_action TEXT,
    winner TEXT,
    battle_message_id BIGINT,
    challenge_message_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Battle Logs (History) Table
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Updated_at Trigger
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

-- 6. Unique Constraint on Battle Logs (Make them replay-safe)
ALTER TABLE battle_logs ADD CONSTRAINT unique_battle_round UNIQUE(battle_id, round_number);

-- 7. Timeout Enforcement (pg_cron)
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
