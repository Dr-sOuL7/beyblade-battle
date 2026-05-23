-- infrastructure/migrations/03_matchmaking.sql

CREATE TABLE IF NOT EXISTS matchmaking_queue (
    telegram_id BIGINT PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    username TEXT NOT NULL,
    elo INT NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE battles ADD COLUMN IF NOT EXISTS chat_id_2 BIGINT;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS battle_message_id_2 BIGINT;
