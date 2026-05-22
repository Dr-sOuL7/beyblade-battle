from __future__ import annotations
from html import escape
from telegram import InlineKeyboardButton, InlineKeyboardMarkup

_ACTION_LABELS = {
    "attack":  "Attack ⚔️",
    "defend":  "Defend 🛡️",
    "evade":   "Evade 💨",
    "special": "Special ✨",
}


def challenge_keyboard(battle_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Accept",  callback_data=f"accept_{battle_id}"),
        InlineKeyboardButton("❌ Decline", callback_data=f"decline_{battle_id}"),
    ]])


# ── Per-player action row ────────────────────────────────────────────────────

def _player_row(battle_id: str, player: dict, p_key: str) -> list[InlineKeyboardButton]:
    """Four action buttons for one player, with Special locked/unlocked."""
    charge = player["charge"]
    row = [
        InlineKeyboardButton("⚔️ Attack", callback_data=f"act_{battle_id}_{p_key}_atk"),
        InlineKeyboardButton("🛡️ Defend", callback_data=f"act_{battle_id}_{p_key}_def"),
        InlineKeyboardButton("💨 Evade",  callback_data=f"act_{battle_id}_{p_key}_eva"),
    ]
    if charge >= 100:
        row.append(InlineKeyboardButton("✨ Special", callback_data=f"act_{battle_id}_{p_key}_spc"))
    else:
        row.append(InlineKeyboardButton(f"🔒 {charge}/100", callback_data="disabled"))
    return row


# ── Single shared battle keyboard ────────────────────────────────────────────

def battle_keyboard(battle: dict) -> InlineKeyboardMarkup:
    """
    One keyboard row per player with their action buttons.
    Players who have already picked will be blocked by the callback handler,
    not by the UI — this avoids needing to edit the message mid-round.
    """
    bid  = battle["battle_id"]
    rows = []
    for pk in ("player1", "player2"):
        p_short = "p1" if pk == "player1" else "p2"
        rows.append(_player_row(bid, battle[pk], p_short))
    return InlineKeyboardMarkup(rows)


# ── Battle message text (HTML) ───────────────────────────────────────────────

HP_MAX      = 100
SPIN_MAX    = 200
SPECIAL_MAX = 100
BAR_LEN     = 10   # segments in each bar


def _bar(current: int, maximum: int) -> str:
    """Return a 10-segment block bar based on current/max ratio."""
    filled = round((current / maximum) * BAR_LEN)
    filled = max(0, min(BAR_LEN, filled))
    return "█" * filled + "░" * (BAR_LEN - filled)



def _player_stats(p: dict) -> str:
    hp_bar = _bar(p["health"], HP_MAX)
    sp_bar = _bar(p["spin"],   SPIN_MAX)
    ch_bar = _bar(p["charge"], SPECIAL_MAX)
    ready  = " ✨ READY" if p["charge"] >= SPECIAL_MAX else ""
    name   = escape(p["username"])
    return (
        f"@{name}\n"
        f"  ❤️ HP      {hp_bar} {p['health']}\n"
        f"  🌀 SPIN    {sp_bar} {p['spin']}\n"
        f"  ⚡ SPECIAL {ch_bar} {p['charge']}/100{ready}"
    )


def battle_message_text(battle: dict) -> str:
    p1  = battle["player1"]
    p2  = battle["player2"]
    rnd = battle["round"]

    return (
        f"⚔️ <b>Round {rnd} — Make Your Move!</b>\n\n"
        f"{_player_stats(p1)}\n\n"
        f"{_player_stats(p2)}"
    )
