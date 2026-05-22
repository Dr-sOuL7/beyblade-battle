from __future__ import annotations
# ─────────────────────────────────────────────
#  Combat resolution
# ─────────────────────────────────────────────

# Keys are (effective_p1_action, effective_p2_action)
# Values are (p1_spin_loss, p2_spin_loss, p1_hp_loss, p2_hp_loss, p1_charge_gain, p2_charge_gain)
COMBAT_TABLE: dict[tuple[str, str], tuple[int, int, int, int, int, int]] = {
    ("attack", "attack"): (15, 15, 10, 10, 5,  5),
    ("attack", "defend"): (10, 5,  0,  5,  5,  15),
    ("attack", "evade"):  (5,  0,  0,  0,  0,  10),
    ("defend", "attack"): (5,  10, 5,  0,  15, 5),
    ("defend", "defend"): (0,  0,  0,  0,  0,  0),
    ("defend", "evade"):  (0,  0,  0,  0,  0,  0),
    ("evade",  "attack"): (0,  5,  0,  0,  10, 0),
    ("evade",  "defend"): (0,  0,  0,  0,  0,  0),
    ("evade",  "evade"):  (0,  0,  0,  0,  0,  0),
}

# Special override: opponent HP damage based on OPPONENT's action
SPECIAL_DAMAGE: dict[str, int] = {
    "attack": 20,
    "defend": 15,
    "evade":  10,
}


def resolve_round(p1: dict, p2: dict) -> dict:
    """
    Resolve one round. Returns a result dict with all deltas and winner info.
    p1/p2 are mutated in-place.
    """
    raw_p1 = p1["action"]   # may be "special"
    raw_p2 = p2["action"]

    eff_p1 = "attack" if raw_p1 == "special" else raw_p1
    eff_p2 = "attack" if raw_p2 == "special" else raw_p2

    (p1_spin_loss, p2_spin_loss,
     p1_hp_loss,   p2_hp_loss,
     p1_charge,    p2_charge) = COMBAT_TABLE[(eff_p1, eff_p2)]

    # Special override — only the HP dealt TO the opponent changes
    if raw_p1 == "special":
        p2_hp_loss = SPECIAL_DAMAGE[eff_p2]
        p1["charge"] = 0          # reset before adding (already 0 after spend)

    if raw_p2 == "special":
        p1_hp_loss = SPECIAL_DAMAGE[eff_p1]
        p2["charge"] = 0

    # Apply combat table
    p1["spin"]   = max(0, p1["spin"]   - p1_spin_loss)
    p2["spin"]   = max(0, p2["spin"]   - p2_spin_loss)
    p1["health"] = max(0, p1["health"] - p1_hp_loss)
    p2["health"] = max(0, p2["health"] - p2_hp_loss)
    p1["charge"] = min(100, p1["charge"] + p1_charge)
    p2["charge"] = min(100, p2["charge"] + p2_charge)

    # Passive spin decay — 5 per round, always, regardless of actions
    PASSIVE_SPIN = 5
    p1["spin"] = max(0, p1["spin"] - PASSIVE_SPIN)
    p2["spin"] = max(0, p2["spin"] - PASSIVE_SPIN)
    p1_spin_loss += PASSIVE_SPIN
    p2_spin_loss += PASSIVE_SPIN

    # Win conditions
    p1_dead = p1["health"] <= 0 or p1["spin"] <= 0
    p2_dead = p2["health"] <= 0 or p2["spin"] <= 0

    if p1_dead and p2_dead:
        winner = "draw"
    elif p1_dead:
        winner = "p2"
    elif p2_dead:
        winner = "p1"
    else:
        winner = None

    # Cause of defeat
    def cause(p: dict) -> str:
        if p["health"] <= 0 and p["spin"] <= 0:
            return "KO + Spin Over!"
        if p["health"] <= 0:
            return "KO!"
        if p["spin"] <= 0:
            return "Spin Over!"
        return ""

    return {
        "p1_spin_loss": p1_spin_loss,
        "p2_spin_loss": p2_spin_loss,
        "p1_hp_loss":   p1_hp_loss,
        "p2_hp_loss":   p2_hp_loss,
        "p1_charge":    p1_charge,
        "p2_charge":    p2_charge,
        "p1_used_special": raw_p1 == "special",
        "p2_used_special": raw_p2 == "special",
        "winner":       winner,
        "p1_cause":     cause(p1),
        "p2_cause":     cause(p2),
    }
