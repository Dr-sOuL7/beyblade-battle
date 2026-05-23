-- infrastructure/migrations/02_ranking.sql

-- Add ranking and competitive fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS elo INT DEFAULT 1000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS win_streak INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS highest_win_streak INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_battles INT DEFAULT 0;
