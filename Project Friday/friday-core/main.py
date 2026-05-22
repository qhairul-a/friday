import os
from dotenv import load_dotenv

load_dotenv()

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from integrations.telegram_bot import run_bot
from profile.storage import load_profile
from brain.claude import one_shot


def send_morning_briefing() -> None:
    import asyncio
    from telegram import Bot
    from integrations.sheets import get_finance_context, extract_sheet_id
    from integrations.tasks import get_tasks_context

    user_id = os.environ.get("FRIDAY_USER_ID", "default")
    telegram_user_id = int(os.environ.get("TELEGRAM_USER_ID", "0"))
    profile = load_profile(user_id)

    sheet_id = extract_sheet_id(profile.finance.google_sheet_id) if profile.finance.google_sheet_id else None
    finance_ctx = get_finance_context(sheet_id) if sheet_id else "No Google Sheet configured."
    tasks_ctx = get_tasks_context(user_id)

    prompt = (
        "Give me a morning briefing covering four things: "
        "first, my finances — how much I've spent this month vs my budget and which category is highest; "
        "second, my open tasks — what's in progress and what's coming up; "
        "third, my short-term goals — which ones I should focus on today; "
        "fourth, my projects — any deadlines or priorities I should be aware of this week. "
        "Keep it under 250 words. Write in plain sentences, no lists or headers.\n\n"
        f"[Current expense data:\n{finance_ctx}]\n\n"
        f"[Open tasks:\n{tasks_ctx}]"
    )

    briefing = one_shot(profile, prompt)

    async def _send():
        bot = Bot(token=os.environ["TELEGRAM_BOT_TOKEN"])
        await bot.send_message(chat_id=telegram_user_id, text=briefing)

    asyncio.run(_send())


def start_scheduler() -> None:
    briefing_time = os.environ.get("MORNING_BRIEFING_TIME", "07:00")
    hour, minute = briefing_time.split(":")
    timezone = os.environ.get("TIMEZONE", "Asia/Singapore")

    scheduler = BackgroundScheduler(timezone=timezone)
    scheduler.add_job(
        send_morning_briefing,
        CronTrigger(hour=int(hour), minute=int(minute), timezone=timezone),
    )
    scheduler.start()


if __name__ == "__main__":
    start_scheduler()
    print("Friday is online. Listening on Telegram...")
    run_bot()
