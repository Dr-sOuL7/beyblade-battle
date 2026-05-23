-- infrastructure/migrations/01_identity.sql

-- Add identity columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Rookie';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bey_name TEXT DEFAULT 'Default Bey';

-- Add snapshot identity columns to battles
ALTER TABLE battles ADD COLUMN IF NOT EXISTS p1_title TEXT;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS p2_title TEXT;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS p1_bey_name TEXT;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS p2_bey_name TEXT;

-- Add highlights array to battles for persistent memory of spectacle moments
ALTER TABLE battles ADD COLUMN IF NOT EXISTS highlights TEXT[] DEFAULT '{}';
