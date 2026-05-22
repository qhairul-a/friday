import os
from datetime import date, datetime, timezone
import anthropic
from profile.schema import FridayProfile


_client = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def _time_greeting() -> str:
    hour = datetime.now(timezone.utc).hour + 8  # SGT = UTC+8
    hour = hour % 24
    if hour < 5:
        return "Good late night"
    elif hour < 12:
        return "Good morning"
    elif hour < 17:
        return "Good afternoon"
    else:
        return "Good evening"


def build_system_prompt(profile: FridayProfile) -> list[dict]:
    name = profile.identity.preferred_name or profile.identity.name or "there"
    today = date.today().strftime("%A, %d %B %Y")
    profile_json = profile.to_json()
    greeting = _time_greeting()

    persona = f"""You are Friday, a personal AI assistant for {name}.

Today is {today}. Greet the user with "{greeting}, {name}" only on their first message of the session.

Behaviour rules:
- Be proactive, concise, and warm. Match {name}'s preferred communication style.
- You are a text assistant. No markdown, no bullet lists, no headers — write in plain natural sentences.
- Call tools or log actions silently. Never say "I'm going to log this" or "I will now check...". Just do it and confirm briefly.
- When you have logged something, confirm in one short sentence. Example: "Got it — $15 at Waterview Minimart logged."
- When asked a question, answer directly. No preamble, no restating the question.
- Be proactive: if you notice something worth flagging (budget close to limit, upcoming deadline), mention it briefly after the main response."""

    return [
        {
            "type": "text",
            "text": persona,
        },
        {
            "type": "text",
            "text": f"Here is everything you know about {name}:\n\n{profile_json}",
            "cache_control": {"type": "ephemeral"},
        },
    ]


def chat(profile: FridayProfile, user_message: str, conversation_history: list[dict] | None = None) -> str:
    client = get_client()
    messages = conversation_history or []
    messages = messages + [{"role": "user", "content": user_message}]

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=build_system_prompt(profile),
        messages=messages,
    )
    return response.content[0].text


def one_shot(profile: FridayProfile, prompt: str) -> str:
    return chat(profile, prompt)
