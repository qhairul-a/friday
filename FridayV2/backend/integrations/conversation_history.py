"""
Shared conversation history backed by Supabase.
Both the Telegram bot and the voice agent read/write here so Friday
maintains a single continuous memory regardless of which interface is used.
"""

import logging
from core.supabase_client import get_supabase

logger = logging.getLogger(__name__)

MAX_HISTORY = 40  # messages (= 20 turns)


def load_history() -> list[dict]:
    """Return the most recent MAX_HISTORY messages, oldest-first, as {role, content} dicts."""
    try:
        result = (
            get_supabase()
            .table("conversations")
            .select("role,content")
            .order("created_at", desc=True)
            .limit(MAX_HISTORY)
            .execute()
        )
        return [{"role": r["role"], "content": r["content"]} for r in reversed(result.data)]
    except Exception as e:
        logger.error("load_history failed: %s", e)
        return []


def save_messages(messages: list[dict], source: str = "telegram") -> None:
    """Append messages to the conversations table. Skips non-text content silently."""
    if not messages:
        return
    try:
        rows = []
        for m in messages:
            content = m.get("content", "")
            if not isinstance(content, str):
                content = str(content)
            if content.strip():
                rows.append({"role": m["role"], "content": content, "source": source})
        if rows:
            get_supabase().table("conversations").insert(rows).execute()
    except Exception as e:
        logger.error("save_messages failed: %s", e)
