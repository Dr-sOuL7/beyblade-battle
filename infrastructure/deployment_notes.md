# Deployment Infrastructure Backup

This document serves as a backup reference for how the Beyblade Battle Bot is configured across third-party platforms (Vercel, Supabase, and Telegram). If the project is ever migrated or rebuilt, refer to these notes to quickly restore the environment.

## 1. Telegram Webhook Setup
The bot uses Webhooks instead of polling. When deployed to a domain (e.g., Vercel), Telegram automatically pushes updates via POST requests to the `/api/telegram/webhook` endpoint.

**Webhook URL format:**
`https://<your-vercel-domain>.vercel.app/api/telegram/webhook`

**Command to set the webhook:**
(Paste this in your browser URL bar, replacing the tokens)
`https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEBHOOK_URL>`

---

## 2. Vercel Environment Variables
For the bot to work securely, the following Environment Variables must be set in your Vercel Project Settings -> Environment Variables.

* `BOT_TOKEN`: Your Telegram Bot Father Token (e.g., `8700297094:AAFKQG-vuPQCTNGrNBYAqExaPFZqq062sNw`)
* `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL (e.g., `https://uksjuxcmelzjxkpicetg.supabase.co`). Ensure it does **not** have `/rest/v1/` at the end.
* `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Secret Key. This is required to bypass Row Level Security (RLS) and securely write to the database from the Vercel server.

---

## 3. Supabase Schema
The database architecture is saved locally in `infrastructure/supabase_schema.sql`.
*   **users**: Tracks Telegram ID, stats (wins/losses/score).
*   **battles**: Tracks ongoing combat state, expiration, player IDs, and stats (HP, Spin, Charge).
*   **battle_logs**: Records round-by-round combat history for analytics and replays.
