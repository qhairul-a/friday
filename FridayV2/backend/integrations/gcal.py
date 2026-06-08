from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
]


def _get_service():
    if not settings.GDRIVE_TOKEN_FILE.exists():
        raise RuntimeError("Google not authorized. Run: python scripts/authorize_google.py")
    creds = Credentials.from_authorized_user_file(str(settings.GDRIVE_TOKEN_FILE), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(settings.GDRIVE_TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return build("calendar", "v3", credentials=creds)


def get_upcoming_events(days: int = 7) -> str:
    service = _get_service()
    tz = ZoneInfo(settings.TIMEZONE)
    now = datetime.now(tz)
    end = now + timedelta(days=days)

    result = service.events().list(
        calendarId="primary",
        timeMin=now.isoformat(),
        timeMax=end.isoformat(),
        maxResults=20,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = result.get("items", [])
    if not events:
        return f"No events in the next {days} days."

    lines = [f"Upcoming events (next {days} days):"]
    for event in events:
        start = event["start"].get("dateTime", event["start"].get("date", ""))
        title = event.get("summary", "Untitled")
        try:
            dt = datetime.fromisoformat(start).astimezone(tz)
            display = dt.strftime("%a %d %b, %H:%M")
        except Exception:
            display = start
        lines.append(f"— {display}: {title}")
    return "\n".join(lines)


def create_event(title: str, start_datetime: str, end_datetime: str, description: str = None) -> str:
    """start_datetime and end_datetime are ISO 8601 strings with timezone offset, e.g. '2026-06-05T15:00:00+08:00'."""
    service = _get_service()
    body = {
        "summary": title,
        "start": {"dateTime": start_datetime, "timeZone": settings.TIMEZONE},
        "end": {"dateTime": end_datetime, "timeZone": settings.TIMEZONE},
    }
    if description:
        body["description"] = description
    service.events().insert(calendarId="primary", body=body).execute()
    return f"Created event: {title}"


def find_events(query: str) -> str:
    service = _get_service()
    tz = ZoneInfo(settings.TIMEZONE)
    now = datetime.now(tz)
    end = now + timedelta(days=60)

    result = service.events().list(
        calendarId="primary",
        timeMin=now.isoformat(),
        timeMax=end.isoformat(),
        q=query,
        maxResults=10,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = result.get("items", [])
    if not events:
        return f"No events found matching '{query}'."

    lines = [f"Found {len(events)} event(s) matching '{query}':"]
    for event in events:
        start = event["start"].get("dateTime", event["start"].get("date", ""))
        try:
            dt = datetime.fromisoformat(start).astimezone(tz)
            display = dt.strftime("%a %d %b, %H:%M")
        except Exception:
            display = start
        lines.append(f"— {display}: {event.get('summary', 'Untitled')}")
    return "\n".join(lines)


def delete_event(query: str) -> str:
    service = _get_service()
    tz = ZoneInfo(settings.TIMEZONE)
    now = datetime.now(tz)
    end = now + timedelta(days=60)

    result = service.events().list(
        calendarId="primary",
        timeMin=now.isoformat(),
        timeMax=end.isoformat(),
        q=query,
        maxResults=5,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = result.get("items", [])
    if not events:
        return f"No upcoming events found matching '{query}'."
    if len(events) > 1:
        titles = ", ".join(e.get("summary", "Untitled") for e in events[:3])
        return f"Multiple events match '{query}': {titles}. Be more specific."

    event = events[0]
    title = event.get("summary", "Untitled")
    service.events().delete(calendarId="primary", eventId=event["id"]).execute()
    return f"Deleted event: {title}"
