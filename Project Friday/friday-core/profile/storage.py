import os
from datetime import datetime, timezone
from supabase import create_client, Client
from profile.schema import FridayProfile


def _client() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def load_profile(user_id: str) -> FridayProfile:
    client = _client()
    result = client.table("profiles").select("data").eq("user_id", user_id).maybe_single().execute()
    if result and result.data:
        return FridayProfile.from_dict(result.data["data"])
    return FridayProfile()


def save_profile(user_id: str, profile: FridayProfile) -> None:
    client = _client()
    now = datetime.now(timezone.utc).isoformat()
    client.table("profiles").upsert({
        "user_id": user_id,
        "data": profile.to_dict(),
        "updated_at": now,
    }, on_conflict="user_id").execute()


def update_section(user_id: str, section: str, value: dict) -> FridayProfile:
    profile = load_profile(user_id)
    if hasattr(profile, section):
        current = getattr(profile, section)
        if hasattr(current, "__dict__"):
            for k, v in value.items():
                if hasattr(current, k):
                    setattr(current, k, v)
        else:
            setattr(profile, section, value)
    save_profile(user_id, profile)
    return profile


def append_note(user_id: str, note: str) -> None:
    profile = load_profile(user_id)
    profile.notes.append({"text": note, "timestamp": datetime.now(timezone.utc).isoformat()})
    save_profile(user_id, profile)


def log_capture(user_id: str, raw_text: str, routed_to: str, status: str = "captured") -> None:
    client = _client()
    client.table("capture_log").insert({
        "user_id": user_id,
        "raw_text": raw_text,
        "routed_to": routed_to,
        "status": status,
    }).execute()
