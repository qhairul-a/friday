"""
FridayV2 REST API — serves the web dashboard.
Co-runs with the Telegram bot via asyncio in main.py.
Port: 8001
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
from calendar import monthrange
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(title="Friday API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origins=["https://friday-qhairul.vercel.app"],
    allow_origin_regex=r"http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ─── Calendar ─────────────────────────────────────────────────────────────────

def _cal_service():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    SCOPES = [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/tasks",
        "https://www.googleapis.com/auth/spreadsheets",
    ]
    creds = Credentials.from_authorized_user_file(str(settings.GDRIVE_TOKEN_FILE), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(settings.GDRIVE_TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return build("calendar", "v3", credentials=creds)


@app.get("/calendar")
def get_calendar(days: int = 7, month: Optional[str] = None):
    try:
        service = _cal_service()
        tz = ZoneInfo(settings.TIMEZONE)
        if month:
            year, mon = int(month[:4]), int(month[5:7])
            time_min = datetime(year, mon, 1, tzinfo=tz)
            time_max = datetime(year, mon, monthrange(year, mon)[1], 23, 59, 59, tzinfo=tz)
        else:
            now = datetime.now(tz)
            time_min, time_max = now, now + timedelta(days=days)
        result = service.events().list(
            calendarId="primary",
            timeMin=time_min.isoformat(),
            timeMax=time_max.isoformat(),
            maxResults=50,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        events = []
        for e in result.get("items", []):
            start_raw = e["start"].get("dateTime", e["start"].get("date", ""))
            end_raw = e["end"].get("dateTime", e["end"].get("date", ""))
            events.append({
                "id": e["id"],
                "title": e.get("summary", "Untitled"),
                "start": start_raw,
                "end": end_raw,
                "description": e.get("description", ""),
                "location": e.get("location", ""),
            })
        return events
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


class CreateEventRequest(BaseModel):
    title: str
    start: str
    end: str
    description: Optional[str] = None


@app.post("/calendar")
def create_calendar_event(body: CreateEventRequest):
    try:
        service = _cal_service()
        event_body = {
            "summary": body.title,
            "start": {"dateTime": body.start, "timeZone": settings.TIMEZONE},
            "end": {"dateTime": body.end, "timeZone": settings.TIMEZONE},
        }
        if body.description:
            event_body["description"] = body.description
        created = service.events().insert(calendarId="primary", body=event_body).execute()
        return {"id": created["id"], "title": body.title}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/calendar/{event_id}")
def delete_calendar_event(event_id: str):
    try:
        service = _cal_service()
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Tasks ────────────────────────────────────────────────────────────────────

def _tasks_service():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    SCOPES = [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/tasks",
        "https://www.googleapis.com/auth/spreadsheets",
    ]
    creds = Credentials.from_authorized_user_file(str(settings.GDRIVE_TOKEN_FILE), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(settings.GDRIVE_TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return build("tasks", "v1", credentials=creds)


@app.get("/tasklists")
def get_tasklists():
    try:
        service = _tasks_service()
        result = service.tasklists().list(maxResults=100).execute()
        return [{"id": l["id"], "title": l.get("title", "")} for l in result.get("items", [])]
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


class CreateTaskListRequest(BaseModel):
    title: str


class RenameTaskListRequest(BaseModel):
    title: str


@app.post("/tasklists")
def create_tasklist(body: CreateTaskListRequest):
    try:
        service = _tasks_service()
        created = service.tasklists().insert(body={"title": body.title}).execute()
        return {"id": created["id"], "title": body.title}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.patch("/tasklists/{list_id}")
def rename_tasklist(list_id: str, body: RenameTaskListRequest):
    try:
        service = _tasks_service()
        service.tasklists().patch(tasklist=list_id, body={"title": body.title}).execute()
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/tasklists/{list_id}")
def delete_tasklist(list_id: str):
    try:
        service = _tasks_service()
        service.tasklists().delete(tasklist=list_id).execute()
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/tasks")
def get_tasks(list_id: Optional[str] = None):
    try:
        service = _tasks_service()
        if list_id:
            tl = service.tasklists().get(tasklist=list_id).execute()
            lists_to_fetch = [{"id": list_id, "title": tl.get("title", "")}]
        else:
            result = service.tasklists().list(maxResults=100).execute()
            lists_to_fetch = [{"id": l["id"], "title": l.get("title", "")} for l in result.get("items", [])]
        tasks = []
        for lst in lists_to_fetch:
            res = service.tasks().list(tasklist=lst["id"], showCompleted=False, maxResults=100).execute()
            for t in res.get("items", []):
                tasks.append({
                    "id": t["id"],
                    "title": t.get("title", "Untitled"),
                    "due": t.get("due", None),
                    "notes": t.get("notes", ""),
                    "status": t.get("status", "needsAction"),
                    "completed": t.get("completed", None),
                    "list_id": lst["id"],
                    "list_title": lst["title"],
                })
        return tasks
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


class CreateTaskRequest(BaseModel):
    title: str
    due: Optional[str] = None
    notes: Optional[str] = None
    list_id: str = "@default"


@app.post("/tasks")
def create_task(body: CreateTaskRequest):
    try:
        service = _tasks_service()
        task_body = {"title": body.title, "status": "needsAction"}
        if body.due:
            task_body["due"] = body.due
        if body.notes:
            task_body["notes"] = body.notes
        created = service.tasks().insert(tasklist=body.list_id, body=task_body).execute()
        return {"id": created["id"], "title": body.title}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    due: Optional[str] = None
    notes: Optional[str] = None


@app.patch("/tasks/{task_id}")
def update_task(task_id: str, body: UpdateTaskRequest, list_id: str = "@default"):
    try:
        service = _tasks_service()
        task = service.tasks().get(tasklist=list_id, task=task_id).execute()
        if body.title is not None:
            task["title"] = body.title
        if body.due is not None:
            task["due"] = body.due
        elif body.due == "":
            task.pop("due", None)
        if body.notes is not None:
            task["notes"] = body.notes
        service.tasks().update(tasklist=list_id, task=task_id, body=task).execute()
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: str, list_id: str = "@default"):
    try:
        service = _tasks_service()
        task = service.tasks().get(tasklist=list_id, task=task_id).execute()
        task["status"] = "completed"
        service.tasks().update(tasklist=list_id, task=task_id, body=task).execute()
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/tasks/{task_id}")
def delete_task(task_id: str, list_id: str = "@default"):
    try:
        service = _tasks_service()
        service.tasks().delete(tasklist=list_id, task=task_id).execute()
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Finance ──────────────────────────────────────────────────────────────────

import json as _json
from pathlib import Path as _Path

from integrations.gsheets import get_all_rows, append_row, update_row, delete_row
from integrations.finance import _fixed_id, _variable_id, _savings_id, _parse_amount, _current_month, fetch_income

_FINANCE_CONFIG = _Path(__file__).parent / "data" / "finance_config.json"

def _read_finance_config() -> dict:
    try:
        return _json.loads(_FINANCE_CONFIG.read_text())
    except Exception:
        return {"monthly_income": 0.0}

def _write_finance_config(data: dict) -> None:
    _FINANCE_CONFIG.write_text(_json.dumps(data))


def _norm(r: dict) -> dict:
    """Normalize sheet row keys to lowercase so frontend receives consistent casing."""
    return {k.lower(): v for k, v in r.items()}


@app.get("/finance/fixed")
def get_fixed_expenses():
    try:
        rows = get_all_rows(_fixed_id())
        return [{"_index": i, **_norm(r)} for i, r in enumerate(rows)]
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


class FixedExpenseBody(BaseModel):
    item: str
    cost: float
    comments: Optional[str] = ""


@app.post("/finance/fixed")
def add_fixed_expense(body: FixedExpenseBody):
    try:
        append_row(_fixed_id(), [body.item, str(body.cost), body.comments or ""])
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.put("/finance/fixed/{row_index}")
def edit_fixed_expense(row_index: int, body: FixedExpenseBody):
    try:
        update_row(_fixed_id(), row_index, [body.item, str(body.cost), body.comments or ""])
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/finance/fixed/{row_index}")
def delete_fixed_expense(row_index: int):
    try:
        delete_row(_fixed_id(), row_index)
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/finance/variable/all")
def get_all_variable_expenses():
    try:
        rows = get_all_rows(_variable_id())
        return [{"_index": i, **_norm(r)} for i, r in enumerate(rows)]
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/finance/variable")
def get_variable_expenses(month: Optional[str] = None):
    try:
        rows = get_all_rows(_variable_id())
        target = month or _current_month()
        result = []
        for i, r in enumerate(rows):
            norm = _norm(r)
            if norm.get("date", "").startswith(target):
                result.append({"_index": i, **norm})
        return result
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


class VariableExpenseBody(BaseModel):
    date: str
    category: str
    description: str
    amount: float


@app.post("/finance/variable")
def add_variable_expense(body: VariableExpenseBody):
    try:
        append_row(_variable_id(), [body.date, body.category, body.description, "Friday", str(body.amount)])
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.put("/finance/variable/{row_index}")
def edit_variable_expense(row_index: int, body: VariableExpenseBody):
    try:
        update_row(_variable_id(), row_index, [body.date, body.category, body.description, "Friday", str(body.amount)])
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/finance/variable/{row_index}")
def delete_variable_expense(row_index: int):
    try:
        delete_row(_variable_id(), row_index)
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/finance/summary")
def get_finance_summary(month: Optional[str] = None):
    try:
        target = month or _current_month()
        fixed_rows = get_all_rows(_fixed_id())
        var_rows = get_all_rows(_variable_id())

        fixed_rows = [_norm(r) for r in fixed_rows]
        var_rows = [_norm(r) for r in var_rows]
        fixed_total = sum(_parse_amount(r.get("cost", 0)) for r in fixed_rows)
        month_vars = [r for r in var_rows if r.get("date", "").startswith(target)]
        variable_total = sum(_parse_amount(r.get("amount", 0)) for r in month_vars)

        by_category: dict[str, float] = {}
        for r in month_vars:
            cat = r.get("category", "Other")
            by_category[cat] = by_category.get(cat, 0) + _parse_amount(r.get("amount", 0))

        return {
            "month": target,
            "fixed_total": round(fixed_total, 2),
            "variable_total": round(variable_total, 2),
            "total": round(fixed_total + variable_total, 2),
            "currency": settings.CURRENCY,
            "by_category": {k: round(v, 2) for k, v in sorted(by_category.items(), key=lambda x: -x[1])},
        }
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/finance/income")
def get_income():
    try:
        return {"amount": fetch_income()}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


class IncomeBody(BaseModel):
    amount: float


@app.post("/finance/income")
def set_income(body: IncomeBody):
    try:
        cfg = _read_finance_config()
        cfg["monthly_income"] = body.amount
        _write_finance_config(cfg)
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/finance/savings/all")
def get_all_savings():
    try:
        rows = get_all_rows(_savings_id())
        return [{"_index": i, **_norm(r)} for i, r in enumerate(rows)]
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/finance/savings")
def get_savings(month: Optional[str] = None):
    try:
        rows = get_all_rows(_savings_id())
        target = month or _current_month()
        result = []
        for i, r in enumerate(rows):
            norm = _norm(r)
            if norm.get("date", "").startswith(target):
                result.append({"_index": i, **norm})
        return result
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/finance/savings")
def add_saving(body: VariableExpenseBody):
    try:
        append_row(_savings_id(), [body.date, body.category, body.description, str(body.amount)])
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.put("/finance/savings/{row_index}")
def edit_saving(row_index: int, body: VariableExpenseBody):
    try:
        update_row(_savings_id(), row_index, [body.date, body.category, body.description, str(body.amount)])
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/finance/savings/{row_index}")
def delete_saving(row_index: int):
    try:
        delete_row(_savings_id(), row_index)
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Routines ─────────────────────────────────────────────────────────────────

from core.supabase_client import get_supabase


@app.get("/routines")
def get_routines():
    try:
        from integrations.routines import _reset_stale
        result = get_supabase().table("routines").select("*").order("scheduled_time").execute()
        return _reset_stale(result.data)
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.patch("/routines/{routine_id}/toggle")
def toggle_routine(routine_id: str):
    try:
        sb = get_supabase()
        row = sb.table("routines").select("is_done").eq("id", routine_id).single().execute().data
        if row["is_done"]:
            sb.table("routines").update({"is_done": False, "done_date": None}).eq("id", routine_id).execute()
        else:
            sb.table("routines").update({"is_done": True, "done_date": date.today().isoformat()}).eq("id", routine_id).execute()
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Fitness ──────────────────────────────────────────────────────────────────

@app.post("/fitness/sync")
def sync_fitness():
    try:
        from integrations.fitness import sync_today
        result = sync_today()
        return {"ok": True, "message": result}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/fitness/today")
def get_fitness_today():
    try:
        from integrations.fitness import sync_today, _read_row, _today
        today = _today()
        row = _read_row(today)
        if not row:
            try:
                sync_today()
                row = _read_row(today)
            except Exception as sync_err:
                logger.warning("Auto-sync on /fitness/today failed: %s", sync_err)
        if not row:
            raise HTTPException(status_code=404, detail="No fitness data for today")
        return row
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Weather ──────────────────────────────────────────────────────────────────

@app.get("/weather")
def get_weather(lat: float, lon: float):
    try:
        from integrations.weather import fetch_weather
        return fetch_weather(lat, lon)
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Briefings ────────────────────────────────────────────────────────────────

from integrations.briefings import (
    list_briefings, get_briefing, create_briefing, update_briefing, delete_briefing
)


class BriefingCreate(BaseModel):
    name: str = "New Briefing"
    send_time: str = "08:00"
    enabled: bool = True
    sections: list[str] = []


class BriefingUpdate(BaseModel):
    name: Optional[str] = None
    send_time: Optional[str] = None
    enabled: Optional[bool] = None
    sections: Optional[list[str]] = None


@app.get("/briefings")
def get_briefings():
    try:
        return list_briefings()
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/briefings")
async def post_briefing(body: BriefingCreate):
    try:
        b = create_briefing(body.name, body.send_time, body.enabled, body.sections)
        from integrations.telegram_bot import reschedule_briefings
        await reschedule_briefings()
        return b
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.patch("/briefings/{briefing_id}")
async def patch_briefing(briefing_id: str, body: BriefingUpdate):
    try:
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        b = update_briefing(briefing_id, **fields)
        from integrations.telegram_bot import reschedule_briefings
        await reschedule_briefings()
        return b
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/briefings/{briefing_id}")
async def del_briefing(briefing_id: str):
    try:
        delete_briefing(briefing_id)
        from integrations.telegram_bot import reschedule_briefings
        await reschedule_briefings()
        return {"ok": True}
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Notes ────────────────────────────────────────────────────────────────────

@app.get("/notes")
def get_notes(limit: int = 10):
    try:
        from integrations.gdrive_notes import _get_service, _get_friday_folder_id, _strip_timestamp
        service = _get_service()
        folder_id = _get_friday_folder_id(service)
        result = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, modifiedTime)",
            orderBy="modifiedTime desc",
            pageSize=min(limit, 50),
        ).execute()
        return [
            {"id": f["id"], "title": _strip_timestamp(f["name"]), "modified": f["modifiedTime"][:10]}
            for f in result.get("files", [])
        ]
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/notes/search")
def search_notes_endpoint(q: str = ""):
    """Search all .md files in Drive (covers the full Obsidian vault)."""
    try:
        from integrations.gdrive_notes import _get_service, _strip_timestamp
        if not q or len(q.strip()) < 2:
            return []
        service = _get_service()
        keywords = [kw.replace("'", "\\'") for kw in q.split() if len(kw) > 1]
        seen: dict = {}
        for kw in keywords[:3]:
            result = service.files().list(
                q=(
                    f"name contains '.md' "
                    f"and fullText contains '{kw}' "
                    f"and trashed=false"
                ),
                fields="files(id, name, modifiedTime)",
                orderBy="modifiedTime desc",
                pageSize=30,
            ).execute()
            for f in result.get("files", []):
                if f["id"] not in seen:
                    seen[f["id"]] = {
                        "id": f["id"],
                        "title": _strip_timestamp(f["name"].removesuffix(".md")),
                        "modified": f["modifiedTime"][:10],
                    }
        return list(seen.values())
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/notes/tree")
def get_notes_tree():
    try:
        from integrations.gdrive_notes import list_vault_tree
        return list_vault_tree()
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/notes/{file_id}")
def get_note_content(file_id: str):
    try:
        from integrations.gdrive_notes import _get_service, _read_file_content
        service = _get_service()
        meta = service.files().get(fileId=file_id, fields="name").execute()
        if not meta.get("name", "").endswith(".md"):
            raise HTTPException(status_code=403, detail="Access denied")
        return {"content": _read_file_content(service, file_id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Endpoint error")
        raise HTTPException(status_code=500, detail="Internal server error")
