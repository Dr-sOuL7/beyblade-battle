# Beyblade Battle Bot — Antigravity Agent Instructions

## Overview
Build a Telegram bot for a turn-based Beyblade fighting game playable entirely through inline keyboards. The bot is group-chat oriented: one player challenges another by replying to their message with `/fight`, and the two players battle through simultaneous action selection each round.

**Bot Token:** `8740631453:AAEc7ez36UB02YeeQzDnYRh2swChtU4eN98`

---

## Tech Stack Recommendation
- **Language:** Python
- **Library:** `python-telegram-bot` v20+ (async)
- **Storage:** In-memory dictionary (for active battles) — no database needed unless persistence is required
- **Webhook or Polling:** Long polling is fine for development

---

## Bot Commands

| Command | Description |
|---|---|
| `/fight` | Must be used as a **reply** to another user's message. Initiates a challenge to that user. |
| `/stats` | (Optional) Show current battle stats mid-fight for the invoking player. |

---

## Game Data Structures

### Player State (per battle participant)
```python
{
  "user_id": int,
  "username": str,
  "health": 100,      # Starts at 100; if reaches 0 → that player loses
  "spin": 100,        # Starts at 100; if reaches 0 → that player loses
  "charge": 0,        # Starts at 0; Special move unlocks when charge >= 100
  "action": None      # Stores chosen action for the current round
}
```

### Battle State (keyed by a unique battle_id, e.g. f"{chat_id}_{challenger_id}_{defender_id}")
```python
{
  "battle_id": str,
  "chat_id": int,
  "player1": <Player State>,     # The challenger (who sent /fight)
  "player2": <Player State>,     # The challenged (whose message was replied to)
  "round": int,                  # Current round number, starts at 1
  "status": "pending" | "active" | "finished",
  "round_message_id_p1": int,    # Message ID of the action keyboard sent to P1 (via DM or in-chat)
  "round_message_id_p2": int     # Message ID of the action keyboard sent to P2
}
```

---

## Game Flow

### Step 1 — Challenge
1. Player 1 (challenger) sends `/fight` **as a reply** to a message from Player 2 (defender) in a group chat.
2. Bot validates:
   - The command is a reply (not a standalone message). If not, reply: *"You need to reply to someone's message to challenge them!"*
   - The replied-to message is from a real user (not a bot or the challenger themselves). If invalid, reply: *"You can't challenge yourself or a bot!"*
   - Neither player is already in an active battle. If so, reply: *"One or both players are already in an active battle!"*
3. Bot posts a challenge message in the group:
   > **⚔️ Beyblade Battle Challenge!**
   > `@challenger` has challenged `@defender` to a Beyblade battle!
   > `@defender`, do you accept?
   
   With an inline keyboard:
   - `[✅ Accept]` — callback_data: `accept_{battle_id}`
   - `[❌ Decline]` — callback_data: `decline_{battle_id}`

4. Only Player 2 should be able to press Accept/Decline (validate `callback_query.from_user.id == player2.user_id`). If someone else presses it, answer the callback silently with *"This isn't your challenge!"*

### Step 2 — Battle Begins
1. When Player 2 presses Accept:
   - Set battle status to `"active"`.
   - Edit the challenge message to:
     > **🌀 Battle Started! Round 1**
     > `@challenger` vs `@defender`
     > Both players — check your DMs to make your move!
   - Send each player a **private DM** with their action keyboard (see Step 3).
   - If the bot cannot DM a player (they haven't started the bot), post publicly:
     > *"@player, please start a DM with me first by clicking [here](t.me/BOTUSERNAME) and pressing Start, then try again!"*
     and cancel/hold the battle until they do.

2. When Player 2 presses Decline:
   - Delete or edit the challenge message to: *"`@defender` declined the challenge."*
   - Remove the battle from storage.

### Step 3 — Action Selection (Each Round)
Send each player a DM with an inline keyboard. The message should look like:

> **⚔️ Round [N] — Choose Your Move!**
> 
> ❤️ HP: [health] | 🌀 Spin: [spin] | ⚡ Charge: [charge]/100
> 
> *(Opponent — ❤️ HP: [health] | 🌀 Spin: [spin])*

Keyboard layout:
```
[ ⚔️ Attack ]   [ 🛡️ Defend ]
[ 💨 Evade  ]   [ ✨ Special ]   ← Special button is DISABLED (grayed out / different text) if charge < 100
```

To "disable" Special when unavailable, either:
- Show it as `[ 🔒 Special (charge: X/100) ]` with callback_data `disabled` (answer callback with alert: *"Special not available yet!"*)
- Or omit it entirely and show only 3 buttons.

**Recommended:** Show it grayed out with current charge so players can track progress.

Callback data format: `action_{battle_id}_{player_user_id}_{action}`
Where action is one of: `attack`, `defend`, `evade`, `special`

#### Action Validation
- When a player picks an action:
  - Validate it's their battle and their turn.
  - Validate Special: if charge < 100, answer callback with alert *"⚡ Special not ready yet! Charge: X/100"* and do nothing.
  - Store their action in the battle state.
  - Edit their DM keyboard to: *"✅ You chose [action]! Waiting for opponent..."* (remove keyboard).
- When **both** players have submitted actions → proceed to Step 4 (Resolution).

### Step 4 — Round Resolution

#### Determine Effective Actions
- Treat `special` as `attack` for lookup purposes **only** (the attacker using Special is treated as Attack in the matchup table).
- Look up the outcome from the table below.

#### Combat Resolution Table

| P1 Action | P2 Action | P1 Spin −| P2 Spin −| P1 HP −| P2 HP −| P1 Charge +| P2 Charge +|
|---|---|---|---|---|---|---|---|
| Attack | Attack | 15 | 15 | 10 | 10 | 5 | 5 |
| Attack | Defend | 10 | 5 | 0 | 5 | 5 | 15 |
| Attack | Evade | 5 | 0 | 0 | 0 | 0 | 10 |
| Defend | Attack | 5 | 10 | 5 | 0 | 15 | 5 |
| Defend | Defend | 0 | 0 | 0 | 0 | 0 | 0 |
| Defend | Evade | 0 | 0 | 0 | 0 | 0 | 0 |
| Evade | Attack | 0 | 5 | 0 | 0 | 10 | 0 |
| Evade | Defend | 0 | 0 | 0 | 0 | 0 | 0 |
| Evade | Evade | 0 | 0 | 0 | 0 | 0 | 0 |

> **Note:** The table is directional. If P1 used Attack and P2 used Defend, use row "Attack / Defend".  
> If P2 used Attack and P1 used Defend, use row "Defend / Attack" and apply columns accordingly.

#### Special Move Override (Damage Only)
If a player used **Special** (charge was ≥ 100), override **only** the HP damage dealt TO the opponent (i.e., opponent's HP decrease) with:
- Opponent chose **Attack** → deal **20 HP** damage (instead of standard)
- Opponent chose **Defend** → deal **15 HP** damage (instead of standard)
- Opponent chose **Evade** → deal **10 HP** damage (instead of standard)

All other values (spin decreases, charge changes) remain exactly as per the table.

After a player uses Special: **reset their charge to 0**.

#### Apply Results
1. Subtract spin and HP; add charge.
2. **Floor all values at 0** (nothing goes negative).
3. **Cap charge at 100** (charge cannot exceed 100 — it stays at 100 once full until used).

#### Win Condition Check
After applying results, check:
- If a player's **health ≤ 0** → they are defeated (KO'd).
- If a player's **spin ≤ 0** → their Beyblade has stopped spinning (Burst/Stadium Out).
- If **both** reach 0 simultaneously → it's a draw.

If the battle is over, go to Step 5. Otherwise, go to the next round (Step 3).

### Step 5 — Battle End
Post the result in the group chat:

**Win scenario:**
> **🏆 Battle Over! Round [N]**
> 
> 🥇 `@winner` wins!
> 
> **Final Stats:**
> `@player1` — ❤️ HP: X | 🌀 Spin: X
> `@player2` — ❤️ HP: X | 🌀 Spin: X
> 
> *(cause: "KO!" or "Burst!" depending on which stat hit 0)*

**Draw scenario:**
> **🤝 It's a Draw! Both Beyblades stopped simultaneously!**

Remove the battle from active storage.

---

## Round Summary Message (Group Chat)

After each round (whether or not the battle ends), post a round summary in the group:

> **⚔️ Round [N] Results**
> 
> `@p1`: used **[Action]** | `@p2`: used **[Action]**
> 
> `@p1` → ❤️ −[hp_lost] HP | 🌀 −[spin_lost] Spin | ⚡ +[charge_gained] Charge
> `@p2` → ❤️ −[hp_lost] HP | 🌀 −[spin_lost] Spin | ⚡ +[charge_gained] Charge
> 
> **Standings:**
> `@p1` — ❤️ [hp] HP | 🌀 [spin] Spin | ⚡ [charge]/100 Charge
> `@p2` — ❤️ [hp] HP | 🌀 [spin] Spin | ⚡ [charge]/100 Charge

If Special was used, include: `✨ @player used their SPECIAL MOVE!`

---

## Important Edge Cases to Handle

1. **Player leaves mid-battle (bot can't DM):** If a DM fails, post in group: *"@player is unreachable via DM. Battle cancelled."* Clean up battle state.

2. **Player takes too long:** Optional — add a 60-second timeout per round. If a player hasn't chosen in time, auto-assign `Defend` for them and notify in group: *"@player was too slow — defaulted to Defend!"*

3. **Challenge timeout:** If the defender doesn't accept within 60 seconds, cancel and post: *"Challenge expired — @defender didn't respond in time."*

4. **Concurrent battles:** Each user can only be in one battle at a time. Maintain a `active_users: set[int]` to track this. Add both players on battle start, remove both on battle end.

5. **Bot restarted mid-battle:** In-memory state is lost. Add a global fallback: if a callback references an unknown battle_id, reply: *"This battle is no longer active (bot may have restarted)."*

6. **Special at exactly 100:** The Special button should become available as soon as charge **reaches or exceeds** 100. In practice, because charge is floored at 100, simply check `charge >= 100`.

---

## Callback Query Routing Summary

| Callback Data Pattern | Handler |
|---|---|
| `accept_{battle_id}` | Defender accepts — start battle, DM both players |
| `decline_{battle_id}` | Defender declines — cancel battle |
| `action_{battle_id}_{user_id}_attack` | Record Attack action |
| `action_{battle_id}_{user_id}_defend` | Record Defend action |
| `action_{battle_id}_{user_id}_evade` | Record Evade action |
| `action_{battle_id}_{user_id}_special` | Record Special action (validate charge ≥ 100) |
| `disabled` | Silently answer: *"Not available yet!"* |

---

## Summary of All Numeric Constants

| Constant | Value |
|---|---|
| Starting Health | 100 |
| Starting Spin | 100 |
| Starting Charge | 0 |
| Special unlock threshold | 100 |
| Special vs Attack damage (opponent HP) | 20 |
| Special vs Defend damage (opponent HP) | 15 |
| Special vs Evade damage (opponent HP) | 10 |
| Charge after using Special | Reset to 0 |
| Max Charge | 100 (capped) |
| Min for all stats | 0 (floored) |
