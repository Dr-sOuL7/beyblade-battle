from __future__ import annotations
import asyncio
import logging

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import ContextTypes
from telegram.error import TelegramError
from telegram import InlineKeyboardMarkup, InlineKeyboardButton
from html import escape

from state import battles, active_users, remove_battle
from battle import send_battle_message, process_round, round_timeout

logger = logging.getLogger(__name__)


async def callback_router(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    data = query.data or ""

    if data in ("disabled",):
        await query.answer("⚡ Special not ready yet!", show_alert=True)
        return

    if data.startswith("accept_"):
        await handle_accept(query, context)
    elif data.startswith("decline_"):
        await handle_decline(query, context)
    elif data.startswith("act_"):
        await handle_action(query, context)
    else:
        await query.answer("Unknown action.", show_alert=True)


# ─────────────────────────────────────────────
#  Accept / Decline
# ─────────────────────────────────────────────

async def handle_accept(query, context) -> None:
    battle_id = query.data[len("accept_"):]
    battle    = battles.get(battle_id)

    if not battle:
        await query.answer("This battle is no longer active (bot may have restarted).", show_alert=True)
        return

    if query.from_user.id != battle["player2"]["user_id"]:
        await query.answer("This isn't your challenge!", show_alert=True)
        return

    if battle["status"] != "pending":
        await query.answer("Battle already started or finished.", show_alert=True)
        return

    battle["status"] = "active"
    p1_name = escape(battle["player1"]["username"])
    p2_name = escape(battle["player2"]["username"])

    # Edit the challenge message to a simple header
    try:
        await query.edit_message_text(
            f"🌀 <b>Battle Started!</b>\n@{p1_name} ⚔️ @{p2_name}",
            parse_mode=ParseMode.HTML,
        )
    except TelegramError as e:
        logger.warning("Could not edit challenge message: %s", e)

    # Post the ONE shared battle message (Round 1)
    await send_battle_message(context.bot, battle)

    # Start round-1 timeout
    asyncio.create_task(round_timeout(context.bot, battle_id, 1))
    await query.answer()


async def handle_decline(query, context) -> None:
    battle_id = query.data[len("decline_"):]
    battle    = battles.get(battle_id)

    if not battle:
        await query.answer("This battle is no longer active.", show_alert=True)
        return

    if query.from_user.id != battle["player2"]["user_id"]:
        await query.answer("This isn't your challenge!", show_alert=True)
        return

    p2_name = battle["player2"]["username"]
    remove_battle(battle_id)

    await query.edit_message_text(f"@{p2_name} declined the challenge.")
    await query.answer()


# ─────────────────────────────────────────────
#  Action selection
# ─────────────────────────────────────────────

async def handle_action(query, context) -> None:
    # callback_data: "act_{battle_id}_{p_key}_{action}"
    raw    = query.data                        # "act_<battle_id>_<p_key>_<act>"
    after  = raw[len("act_"):]                # "<battle_id>_<p_key>_<act>"
    act_short = after.rsplit("_", 1)[1]       # "atk" / "def" / "eva" / "spc"
    rest   = after.rsplit("_", 1)[0]          # "<battle_id>_<p_key>"
    p_short = rest.rsplit("_", 1)[1]          # "p1" / "p2"
    battle_id  = rest.rsplit("_", 1)[0]       # "<battle_id>"

    action_map = {"atk": "attack", "def": "defend", "eva": "evade", "spc": "special"}
    action = action_map.get(act_short)
    if not action:
        return

    battle = battles.get(battle_id)
    if not battle:
        await query.answer("This battle is no longer active (bot may have restarted).", show_alert=True)
        return

    if battle["status"] != "active":
        await query.answer("Battle is not active.", show_alert=True)
        return

    p_key = "player1" if p_short == "p1" else "player2"
    expected_uid = battle[p_key]["user_id"]

    # The player pressing the button must match the row's owner
    if query.from_user.id != expected_uid:
        await query.answer("These aren't your buttons!", show_alert=True)
        return

    player = battle[p_key]

    if player["action"] is not None:
        await query.answer("You've already locked in your move!", show_alert=True)
        return

    if action == "special" and player["charge"] < 100:
        await query.answer(f"⚡ Special not ready! Charge: {player['charge']}/100", show_alert=True)
        return

    # Lock in the action — just toast the player, don't edit the message yet
    # (editing on every pick triggers Telegram flood control on long matches)
    player["action"] = action
    await query.answer("✅ Move locked in!")

    # If both players have acted → resolve the round
    if battle["player1"]["action"] is not None and battle["player2"]["action"] is not None:
        await process_round(context.bot, battle)
