from __future__ import annotations
import asyncio
import logging

from telegram import Bot, Message
from telegram.error import TelegramError
from telegram.constants import ParseMode

from state import battles, remove_battle
from engine import resolve_round
from keyboards import battle_keyboard, battle_message_text, _player_stats
from html import escape

logger = logging.getLogger(__name__)

ROUND_TIMEOUT = 60   # seconds per round


# ─────────────────────────────────────────────
#  Single shared battle message
# ─────────────────────────────────────────────

async def send_battle_message(bot: Bot, battle: dict) -> None:
    """
    Create or edit the ONE shared battle message in the group.
    Handles Telegram flood control (RetryAfter) with automatic retry.
    """
    from telegram.error import RetryAfter
    chat_id = battle["chat_id"]
    text    = battle_message_text(battle)
    kb      = battle_keyboard(battle)

    if battle.get("battle_message_id"):
        for attempt in range(3):
            try:
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=battle["battle_message_id"],
                    text=text,
                    parse_mode=ParseMode.HTML,
                    reply_markup=kb,
                )
                return
            except RetryAfter as e:
                wait = e.retry_after + 1
                logger.warning("Rate limited on edit — sleeping %ds (attempt %d)", wait, attempt + 1)
                await asyncio.sleep(wait)
            except TelegramError as e:
                logger.warning("Could not edit battle message: %s — sending new one", e)
                break  # fall through to send a new message

    # Either no existing message or edit failed — send a fresh one
    for attempt in range(3):
        try:
            msg: Message = await bot.send_message(
                chat_id=chat_id,
                text=text,
                parse_mode=ParseMode.HTML,
                reply_markup=kb,
            )
            battle["battle_message_id"] = msg.message_id
            return
        except RetryAfter as e:
            wait = e.retry_after + 1
            logger.warning("Rate limited on send — sleeping %ds (attempt %d)", wait, attempt + 1)
            await asyncio.sleep(wait)


async def clear_battle_message_keyboard(bot: Bot, battle: dict) -> None:
    """Strip the keyboard from the battle message when the fight ends."""
    mid = battle.get("battle_message_id")
    if not mid:
        return
    try:
        await bot.edit_message_reply_markup(
            chat_id=battle["chat_id"],
            message_id=mid,
            reply_markup=None,
        )
    except TelegramError:
        pass


# ─────────────────────────────────────────────
#  Round resolution & posting
# ─────────────────────────────────────────────

async def process_round(bot: Bot, battle: dict) -> None:
    """Called when both players have submitted their actions."""
    p1        = battle["player1"]
    p2        = battle["player2"]
    rnd       = battle["round"]
    chat_id   = battle["chat_id"]
    battle_id = battle["battle_id"]

    # Capture chosen actions before resolve_round clears/mutates state
    p1_action = p1["action"]
    p2_action = p2["action"]

    result = resolve_round(p1, p2)
    winner = result["winner"]

    if winner:
        # ── Final round: reveal choices + result inside the battle message ──
        battle["status"] = "finished"

        action_label = {
            "attack": "Attack ⚔️", "defend": "Defend 🛡️",
            "evade":  "Evade 💨",  "special": "Special ✨",
        }
        p1_label = action_label.get(p1_action, p1_action)
        p2_label = action_label.get(p2_action, p2_action)

        special_lines = ""
        if result["p1_used_special"]:
            special_lines += f"✨ @{escape(p1['username'])} used their SPECIAL MOVE!\n"
        if result["p2_used_special"]:
            special_lines += f"✨ @{escape(p2['username'])} used their SPECIAL MOVE!\n"

        if winner == "draw":
            result_line = "🤝 <b>It's a Draw! Both Beyblades stopped simultaneously!</b>"
        else:
            w     = p1 if winner == "p1" else p2
            cause = (result["p2_cause"] if winner == "p1" else result["p1_cause"]) \
                    or result["p1_cause"] or result["p2_cause"]
            result_line = f"🏆 @{escape(w['username'])} wins! <i>{escape(cause)}</i>"

        end_text = (
            f"⚔️ <b>Round {rnd} — Final!</b>\n\n"
            f"{special_lines}"
            f"@{escape(p1['username'])} chose: <b>{p1_label}</b>\n"
            f"@{escape(p2['username'])} chose: <b>{p2_label}</b>\n\n"
            f"{result_line}\n\n"
            f"<b>Final Stats:</b>\n"
            f"{_player_stats(p1)}\n\n"
            f"{_player_stats(p2)}"
        )

        mid = battle.get("battle_message_id")
        try:
            if mid:
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=mid,
                    text=end_text,
                    parse_mode=ParseMode.HTML,
                    reply_markup=None,
                )
            else:
                await bot.send_message(chat_id=chat_id, text=end_text,
                                       parse_mode=ParseMode.HTML)
        except TelegramError as e:
            logger.warning("Could not edit final message: %s", e)
            await bot.send_message(chat_id=chat_id, text=end_text,
                                   parse_mode=ParseMode.HTML)

        remove_battle(battle_id)
        return

    # ── Not the final round: silently advance to next round ─────────────────
    p1["action"] = None
    p2["action"] = None
    battle["round"] += 1

    # Edit the shared battle message in-place for the new round
    await send_battle_message(bot, battle)
    asyncio.create_task(round_timeout(bot, battle_id, battle["round"]))


# ─────────────────────────────────────────────
#  Timeout tasks
# ─────────────────────────────────────────────

async def round_timeout(bot: Bot, battle_id: str, round_num: int) -> None:
    await asyncio.sleep(ROUND_TIMEOUT)
    battle = battles.get(battle_id)
    if not battle or battle["status"] != "active" or battle["round"] != round_num:
        return

    # Find who failed to respond in time
    slow = [
        battle[pk]["username"]
        for pk in ("player1", "player2")
        if battle[pk]["action"] is None
    ]
    if not slow:
        # Both responded — timeout fired late, round already processing
        return

    battle["status"] = "finished"
    await clear_battle_message_keyboard(bot, battle)

    names = " and ".join(f"@{n}" for n in slow)
    await bot.send_message(
        chat_id=battle["chat_id"],
        text=f"⏰ {names} took too long to respond — battle terminated!",
    )
    remove_battle(battle_id)


async def challenge_timeout(bot: Bot, battle_id: str) -> None:
    await asyncio.sleep(ROUND_TIMEOUT)
    battle = battles.get(battle_id)
    if not battle or battle["status"] != "pending":
        return

    chat_id = battle["chat_id"]
    p2_name = battle["player2"]["username"]
    msg_id  = battle.get("challenge_message_id")
    try:
        if msg_id:
            await bot.edit_message_text(
                chat_id=chat_id,
                message_id=msg_id,
                text=f"⌛ Challenge expired — @{p2_name} didn't respond in time.",
            )
    except TelegramError:
        await bot.send_message(chat_id=chat_id,
                               text=f"⌛ Challenge expired — @{p2_name} didn't respond in time.")
    remove_battle(battle_id)
