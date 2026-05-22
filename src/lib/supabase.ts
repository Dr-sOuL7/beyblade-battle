import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey);

/*
Expected Database Tables:

Table: users
- id (uuid, primary key)
- telegram_id (bigint, unique)
- username (text)
- wins (int)
- losses (int)
- score (int)
- created_at (timestamp)

Table: battles
- id (uuid, primary key)
- telegram_chat_id (bigint)
- player1_id (bigint, references users.telegram_id)
- player2_id (bigint, references users.telegram_id)
- status (text) // 'pending', 'active', 'finished'
- round_number (int)
- player1_state (jsonb) // health, spin, charge, action
- player2_state (jsonb)
- battle_message_id (bigint)
- challenge_message_id (bigint)
- created_at (timestamp)
- updated_at (timestamp)
*/
