from __future__ import annotations
import logging
import asyncio

from telegram import Update
from telegram.error import Conflict, NetworkError
from telegram.ext import Application, CommandHandler, CallbackQueryHandler

from config import BOT_TOKEN
from handlers.commands import fight_command, stats_command
from handlers.callbacks import callback_router

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def error_handler(update: object, context) -> None:
    """Log all errors; on Conflict, just log — PTB will retry automatically."""
    err = context.error
    if isinstance(err, Conflict):
        logger.warning("Conflict (duplicate instance?): %s", err)
    elif isinstance(err, NetworkError):
        logger.warning("Network error: %s", err)
    else:
        logger.error("Unhandled exception:", exc_info=err)


def main() -> None:
    app = Application.builder().token(BOT_TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("fight", fight_command))
    app.add_handler(CommandHandler("stats", stats_command))

    # All inline-keyboard callbacks
    app.add_handler(CallbackQueryHandler(callback_router))

    # Global error handler — prevents unhandled exceptions from crashing the loop
    app.add_error_handler(error_handler)

    logger.info("Bot is running...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
