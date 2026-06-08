"""
User memory integration.

Loads Friday's knowledge of the user into the system prompt.
Extracts new facts from conversations in a background thread — never blocks a reply.
"""

import json
import logging
from datetime import datetime, timezone

import anthropic

from core.config import settings
from core.supabase_client import supabase

logger = logging.getLogger(__name__)
_anthropic = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def load_memory() -> str:
    """Return all memory facts as a formatted block for the system prompt."""
    try:
        rows = supabase.table("user_memory").select("category, fact").order("category").execute().data
        if not rows:
            return "(No personal profile yet — this will build up over time.)"

        by_cat: dict[str, list[str]] = {}
        for row in rows:
            by_cat.setdefault(row["category"].title(), []).append(row["fact"])

        lines = []
        for cat, facts in sorted(by_cat.items()):
            lines.append(f"{cat}:")
            for fact in facts:
                lines.append(f"  - {fact}")
        return "\n".join(lines)
    except Exception as e:
        logger.warning("Failed to load user memory: %s", e)
        return ""


def extract_and_save(user_message: str, friday_reply: str) -> None:
    """
    Extract facts about the user from this exchange and persist them.
    Designed to run in a background thread — swallows all exceptions.
    """
    try:
        existing = supabase.table("user_memory").select("id, category, fact").execute().data or []
        existing_text = "\n".join(
            f"[{r['id']}] ({r['category']}) {r['fact']}" for r in existing
        )

        prompt = f"""You are a memory extractor for Friday, a personal AI assistant for Qhairul.

Review this conversation exchange and identify facts about Qhairul worth remembering long-term.

EXTRACT only facts that reveal: preferences, habits, schedule, values, personality, goals, dislikes, hobbies, health patterns, work style, relationships.
DO NOT extract: one-time tasks, specific events, things Qhairul asked Friday to do, temporary states.
DO NOT duplicate anything already in the existing memory list.
If something in existing memory is contradicted or updated, add the new version and flag the old ID for removal.
Each fact must be one concise sentence.

Existing memory (do not re-add):
{existing_text or "(empty)"}

User said: {user_message}
Friday replied: {friday_reply}

Return JSON only — no explanation, no markdown fences:
{{"add": [{{"category": "...", "fact": "...", "source": "stated or inferred"}}], "remove_ids": ["id1", "id2"]}}

Valid categories: work, preferences, hobbies, health, personality, goals, dislikes, relationships
If nothing new was learned: {{"add": [], "remove_ids": []}}"""

        response = _anthropic.messages.create(
            model=settings.FRIDAY_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text.strip()
        # Strip accidental markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        data = json.loads(raw)
        now = datetime.now(timezone.utc).isoformat()

        for item in data.get("add", []):
            if item.get("fact") and item.get("category"):
                supabase.table("user_memory").insert({
                    "category": item["category"].lower(),
                    "fact": item["fact"],
                    "source": item.get("source", "inferred"),
                    "updated_at": now,
                }).execute()

        for remove_id in data.get("remove_ids", []):
            supabase.table("user_memory").delete().eq("id", remove_id).execute()

    except Exception as e:
        logger.warning("Memory extraction failed (non-fatal): %s", e)
