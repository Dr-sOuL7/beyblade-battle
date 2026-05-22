from __future__ import annotations
# ─────────────────────────────────────────────
#  In-memory game state
# ─────────────────────────────────────────────

# battle_id  →  battle_dict
battles: dict[str, dict] = {}

# user_id  →  battle_id  (quick reverse-lookup)
active_users: dict[int, str] = {}


# ── helpers ──────────────────────────────────

def make_player(user_id: int, username: str) -> dict:
    return {
        "user_id": user_id,
        "username": username,
        "health": 100,
        "spin": 200,
        "charge": 0,
        "action": None,
    }


def make_battle(battle_id: str, chat_id: int, player1: dict, player2: dict) -> dict:
    return {
        "battle_id": battle_id,
        "chat_id": chat_id,
        "player1": player1,
        "player2": player2,
        "round": 1,
        "status": "pending",
        "battle_message_id": None,
        "challenge_message_id": None,
    }


def get_battle_for_user(user_id: int) -> dict | None:
    bid = active_users.get(user_id)
    return battles.get(bid) if bid else None


def remove_battle(battle_id: str) -> None:
    battle = battles.pop(battle_id, None)
    if battle:
        active_users.pop(battle["player1"]["user_id"], None)
        active_users.pop(battle["player2"]["user_id"], None)
