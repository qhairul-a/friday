import os
import re
import urllib.request
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo


# ─── iCal reading (no auth needed) ───────────────────────────────────────────

def _parse_ical_date(raw: str, tzid: str | None = None) -> datetime | None:
    clean = re.sub(r"^[^:]+:", "", raw).strip()
    local_tz = ZoneInfo(os.environ.get("TIMEZONE", "Asia/Singapore"))
    try:
        if len(clean) == 8:
            # All-day event — return as midnight in the user's local timezone
            return datetime(int(clean[:4]), int(clean[4:6]), int(clean[6:8]), tzinfo=local_tz)
        if len(clean) >= 15:
            y, mo, d = int(clean[:4]), int(clean[4:6]), int(clean[6:8])
            h, mi, s = int(clean[9:11]), int(clean[11:13]), int(clean[13:15])
            if clean.endswith("Z"):
                # Explicit UTC — convert to local tz so _format_dt gets a correct aware dt
                return datetime(y, mo, d, h, mi, s, tzinfo=timezone.utc)
            elif tzid:
                # TZID present — interpret the local wall-clock time in that zone
                try:
                    return datetime(y, mo, d, h, mi, s, tzinfo=ZoneInfo(tzid))
                except Exception:
                    pass
            # No timezone info at all — assume user's local timezone (safer than UTC)
            return datetime(y, mo, d, h, mi, s, tzinfo=local_tz)
    except ValueError:
        pass
    return None


def _format_dt(dt: datetime) -> str:
    local_tz = ZoneInfo(os.environ.get("TIMEZONE", "Asia/Singapore"))
    if dt.tzinfo is not None:
        dt = dt.astimezone(local_tz)
    else:
        dt = dt.replace(tzinfo=local_tz)
    now = datetime.now(local_tz)
    delta = (dt.date() - now.date()).days
    time_str = dt.strftime("%I:%M %p").lstrip("0") if (dt.hour or dt.minute) else None

    if delta == 0:
        label = "today"
    elif delta == 1:
        label = "tomorrow"
    elif delta < 7:
        label = dt.strftime("%A")
    else:
        label = dt.strftime("%B %-d") if os.name != "nt" else dt.strftime("%B %d").replace(" 0", " ")

    return f"{label} at {time_str}" if time_str else label


def _fetch_ical(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "FridayAgent/1.0"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _parse_ical_events(ical: str) -> list[dict]:
    now = datetime.now(timezone.utc)
    events = []
    for block in ical.split("BEGIN:VEVENT")[1:]:
        summary = re.search(r"^SUMMARY(?:;[^:]+)?:(.+)", block, re.MULTILINE)
        dtstart = re.search(r"^(DTSTART[^:]*):(.+)", block, re.MULTILINE)
        if not summary or not dtstart:
            continue
        title = summary.group(1).strip().replace("\\,", ",").replace("\\n", " ").replace("\\", "")
        # Extract TZID from the property name (e.g. DTSTART;TZID=Asia/Singapore)
        tzid_match = re.search(r"TZID=([^;:]+)", dtstart.group(1))
        tzid = tzid_match.group(1).strip() if tzid_match else None
        start = _parse_ical_date(dtstart.group(2), tzid)
        if not start:
            continue
        # start is always timezone-aware now; convert to UTC for comparison
        start_utc = start.astimezone(timezone.utc)
        if start_utc < now:
            continue
        events.append({"title": title, "start": start})
    return events


def get_upcoming_events(calendar_urls: list[str], max_results: int = 5) -> str:
    urls = [u for u in calendar_urls if u and u.strip()]
    if not urls:
        return "No calendar is configured."

    all_events = []
    for url in urls:
        try:
            all_events.extend(_parse_ical_events(_fetch_ical(url)))
        except Exception:
            pass

    if not all_events:
        return "No upcoming events found."

    all_events.sort(key=lambda e: e["start"])
    top = all_events[:max_results]

    lines = [f"You have {len(top)} upcoming event(s):"]
    for ev in top:
        lines.append(f"- {ev['title']} ({_format_dt(ev['start'])})")
    return "\n".join(lines)


# ─── Google Calendar API (write access) ──────────────────────────────────────

def _get_calendar_service():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    token_file = os.environ.get("GOOGLE_CALENDAR_TOKEN_FILE")
    if not token_file:
        # Derive from client secret path
        client_secret = os.environ.get("GOOGLE_CLIENT_SECRET_FILE", "")
        token_file = os.path.join(os.path.dirname(client_secret), "calendar_token.json")

    if not os.path.exists(token_file):
        raise RuntimeError(
            "Google Calendar not authorized. Run: python scripts/authorize_calendar.py"
        )

    scopes = ["https://www.googleapis.com/auth/calendar.events"]
    creds = Credentials.from_authorized_user_file(token_file, scopes)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(token_file, "w") as f:
            f.write(creds.to_json())

    return build("calendar", "v3", credentials=creds)


def create_event(summary: str, start_iso: str, end_iso: str | None = None, description: str | None = None) -> str:
    """Create an event in the user's primary Google Calendar.

    start_iso / end_iso should be ISO 8601 strings (e.g. '2026-05-22T15:00:00').
    end_iso defaults to 1 hour after start if not provided.
    """
    tz = os.environ.get("TIMEZONE", "Asia/Singapore")

    try:
        start_dt = datetime.fromisoformat(start_iso)
    except ValueError:
        return f"Could not parse start time: {start_iso}"

    end_dt = datetime.fromisoformat(end_iso) if end_iso else start_dt + timedelta(hours=1)

    body: dict = {
        "summary": summary,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": tz},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": tz},
    }
    if description:
        body["description"] = description

    try:
        service = _get_calendar_service()
        service.events().insert(calendarId="primary", body=body).execute()
        return f"Done — '{summary}' added to your calendar for {_format_dt(start_dt)}."
    except RuntimeError as e:
        return str(e)
    except Exception as e:
        return f"Failed to create event: {e}"


def find_events(query: str, max_results: int = 5) -> str:
    """Search upcoming events by keyword. Returns a list with event IDs for use with delete_event."""
    try:
        service = _get_calendar_service()
        now = datetime.now(timezone.utc).isoformat()
        result = service.events().list(
            calendarId="primary",
            q=query,
            timeMin=now,
            maxResults=max_results,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        items = result.get("items", [])
        if not items:
            return f"No upcoming events found matching '{query}'."

        lines = [f"Found {len(items)} event(s) matching '{query}':"]
        for ev in items:
            start_raw = ev["start"].get("dateTime", ev["start"].get("date", ""))
            try:
                raw = start_raw.replace("Z", "+00:00")
                dt = datetime.fromisoformat(raw)
                label = _format_dt(dt)
            except Exception:
                label = start_raw
            lines.append(f"- {ev.get('summary', '(no title)')} — {label} | event_id={ev['id']}")
        return "\n".join(lines)
    except RuntimeError as e:
        return str(e)
    except Exception as e:
        return f"Failed to search events: {e}"


def delete_event(event_id: str) -> str:
    """Delete a calendar event by its ID."""
    try:
        service = _get_calendar_service()
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        return "Event deleted from your calendar."
    except RuntimeError as e:
        return str(e)
    except Exception as e:
        return f"Failed to delete event: {e}"
