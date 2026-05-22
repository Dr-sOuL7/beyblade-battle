from __future__ import annotations
import asyncio
import logging

from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode
from html import escape

from state import battles, active_users, make_player, make_battle
from keyboards import challenge_keyboard
from battle import challenge_timeout

logger = logging.getLogger(__name__)


async def fight_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = update.message
    if not message:
        return

    # Must be a reply
    if not message.reply_to_message:
        await message.reply_text("You need to reply to someone's message to challenge them!")
        return

    challenger = message.from_user
    defender   = message.reply_to_message.from_user

    # Can't challenge a bot or yourself
    if defender.is_bot or defender.id == challenger.id:
        await message.reply_text("You can't challenge yourself or a bot!")
        return

    # Check concurrent battles
    if challenger.id in active_users or defender.id in active_users:
        await message.reply_text("One or both players are already in an active battle!")
        return

    chat_id    = message.chat_id
    c_name     = challenger.username or challenger.first_name
    d_name     = defender.username   or defender.first_name

    battle_id  = f"{chat_id}_{challenger.id}_{defender.id}"
    p1 = make_player(challenger.id, c_name)
    p2 = make_player(defender.id,   d_name)
    battle = make_battle(battle_id, chat_id, p1, p2)

    battles[battle_id]       = battle
    active_users[challenger.id] = battle_id
    active_users[defender.id]   = battle_id

    kb  = challenge_keyboard(battle_id)
    msg = await message.reply_text(
        f"⚔️ <b>Beyblade Battle Challenge!</b>\n\n"
        f"@{escape(c_name)} has challenged @{escape(d_name)} to a Beyblade battle!\n"
        f"@{escape(d_name)}, do you accept?",
        parse_mode=ParseMode.HTML,
        reply_markup=kb,
    )
    battle["challenge_message_id"] = msg.message_id

    # Kick off the 60-second challenge timeout
    asyncio.create_task(challenge_timeout(context.bot, battle_id))


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not user:
        return

    bid = active_users.get(user.id)
    if not bid:
        await update.message.reply_text("You are not in an active battle.")
        return

    battle = battles[bid]
    pk  = "player1" if battle["player1"]["user_id"] == user.id else "player2"
    me  = battle[pk]
    opp = battle["player2"] if pk == "player1" else battle["player1"]

    await update.message.reply_text(
        f"📊 <b>Your Stats (Round {battle['round']})</b>\n\n"
        f"❤️ HP: {me['health']} | 🌀 Spin: {me['spin']} | ⚡ Charge: {me['charge']}/100\n\n"
        f"<b>Opponent (@{escape(opp['username'])}):</b>\n"
        f"❤️ HP: {opp['health']} | 🌀 Spin: {opp['spin']}",
        parse_mode=ParseMode.HTML,
    )
