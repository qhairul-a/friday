"""
Google Drive notes integration for FridayV2.
Notes are stored as .md files inside Q_obsidian/Friday/ in Google Drive.
All credentials are scoped to qhairul.asmai@gmail.com.
"""

import io
import re
from datetime import datetime
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload

from core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
]

_friday_folder_id_cache: str | None = None


def _get_service():
    token_file = str(settings.GDRIVE_TOKEN_FILE)
    if not settings.GDRIVE_TOKEN_FILE.exists():
        raise RuntimeError(
            f"Google Drive not authorized. Run:\n"
            f"  python scripts/authorize_google.py\n"
            f"Expected token at: {token_file}"
        )

    creds = Credentials.from_authorized_user_file(token_file, SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(token_file, "w") as f:
            f.write(creds.to_json())

    return build("drive", "v3", credentials=creds)


def _get_friday_folder_id(service) -> str:
    global _friday_folder_id_cache
    if _friday_folder_id_cache:
        return _friday_folder_id_cache

    vault_name = settings.GDRIVE_VAULT_NAME

    result = service.files().list(
        q=f"name='{vault_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)",
        pageSize=5,
    ).execute()
    vaults = result.get("files", [])
    if not vaults:
        raise RuntimeError(
            f"Google Drive folder '{vault_name}' not found. "
            f"Check GDRIVE_VAULT_NAME in .env."
        )
    vault_id = vaults[0]["id"]

    result = service.files().list(
        q=(
            f"name='Friday' and mimeType='application/vnd.google-apps.folder' "
            f"and '{vault_id}' in parents and trashed=false"
        ),
        fields="files(id, name)",
        pageSize=5,
    ).execute()
    friday_folders = result.get("files", [])

    if friday_folders:
        friday_id = friday_folders[0]["id"]
    else:
        folder = service.files().create(
            body={
                "name": "Friday",
                "mimeType": "application/vnd.google-apps.folder",
                "parents": [vault_id],
            },
            fields="id",
        ).execute()
        friday_id = folder["id"]
        print(f"[gdrive_notes] Created Friday/ folder inside '{vault_name}'.")

    _friday_folder_id_cache = friday_id
    return friday_id


def _safe_filename(text: str) -> str:
    return re.sub(r'[<>:"/\\|?*\n\r]', "", text).strip()[:50]


def _strip_timestamp(name: str) -> str:
    return re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", name.removesuffix(".md"))


# ─── Public API ───────────────────────────────────────────────────────────────

def save_note(title: str, content: str) -> str:
    """Save a new markdown note to the Friday folder in Google Drive."""
    tz = ZoneInfo(settings.TIMEZONE)
    now = datetime.now(tz)
    timestamp_str = now.strftime("%Y-%m-%d %H%M")
    display_ts = now.strftime("%Y-%m-%d %H:%M")

    filename = f"{timestamp_str} {_safe_filename(title)}.md"
    body = f"# {title}\n\n{content}\n\n---\n*Captured by Friday · {display_ts}*\n"

    service = _get_service()
    folder_id = _get_friday_folder_id(service)

    service.files().create(
        body={"name": filename, "parents": [folder_id]},
        media_body=MediaIoBaseUpload(
            io.BytesIO(body.encode("utf-8")), mimetype="text/plain", resumable=False
        ),
        fields="id",
    ).execute()
    return f"Saved note: {title}"


def list_notes(limit: int = 10) -> str:
    """List the most recent notes in the Friday folder."""
    service = _get_service()
    folder_id = _get_friday_folder_id(service)

    result = service.files().list(
        q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id, name, modifiedTime)",
        orderBy="modifiedTime desc",
        pageSize=limit,
    ).execute()
    files = result.get("files", [])
    if not files:
        return "No notes found."

    lines = [f"Recent notes ({len(files)}):"]
    for f in files:
        lines.append(f"— {_strip_timestamp(f['name'])} (saved {f['modifiedTime'][:10]})")
    return "\n".join(lines)


def search_notes(query: str, max_results: int = 5) -> str:
    """Search notes in the Friday folder by keyword."""
    keywords = [kw.lower() for kw in query.split() if len(kw) > 2]
    if not keywords:
        return "Please provide a search term."

    service = _get_service()
    folder_id = _get_friday_folder_id(service)

    seen: dict[str, dict] = {}
    for kw in keywords[:3]:
        safe_kw = kw.replace("'", "\\'")
        result = service.files().list(
            q=(
                f"'{folder_id}' in parents "
                f"and fullText contains '{safe_kw}' "
                f"and trashed=false"
            ),
            fields="files(id, name, modifiedTime)",
            orderBy="modifiedTime desc",
            pageSize=10,
        ).execute()
        for f in result.get("files", []):
            if f["id"] not in seen:
                seen[f["id"]] = f

    if not seen:
        return f"No notes found matching '{query}'."

    files = sorted(seen.values(), key=lambda x: x["modifiedTime"], reverse=True)[:max_results]

    lines = [f"Found {len(files)} note(s) for '{query}':\n"]
    for f in files:
        content = _read_file_content(service, f["id"])
        snippet_lines = [
            ln for ln in content.splitlines()
            if ln.strip() and not ln.startswith("#") and not ln.startswith("---")
        ]
        snippet = " ".join(snippet_lines)[:150]
        lines.append(f"— {_strip_timestamp(f['name'])}\n  {snippet}{'…' if len(snippet) == 150 else ''}\n")

    return "\n".join(lines).strip()


def read_note(title_query: str) -> str:
    """Read the full content of a note by partial title match."""
    service = _get_service()
    folder_id = _get_friday_folder_id(service)

    result = service.files().list(
        q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id, name)",
        pageSize=50,
    ).execute()
    files = result.get("files", [])
    matches = [f for f in files if title_query.lower() in f["name"].lower()]

    if not matches:
        return f"No note found matching '{title_query}'."
    if len(matches) > 1:
        names = ", ".join(_strip_timestamp(f["name"]) for f in matches[:4])
        return f"Multiple notes match '{title_query}': {names}. Be more specific."

    return _read_file_content(service, matches[0]["id"])


def edit_note(title_query: str, new_content: str) -> str:
    """Replace the content of an existing note by partial title match."""
    service = _get_service()
    folder_id = _get_friday_folder_id(service)

    result = service.files().list(
        q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id, name)",
        pageSize=50,
    ).execute()
    matches = [f for f in result.get("files", []) if title_query.lower() in f["name"].lower()]

    if not matches:
        return f"No note found matching '{title_query}'."
    if len(matches) > 1:
        names = ", ".join(_strip_timestamp(f["name"]) for f in matches[:4])
        return f"Multiple notes match '{title_query}': {names}. Be more specific."

    f = matches[0]
    display_title = _strip_timestamp(f["name"])
    tz = ZoneInfo(settings.TIMEZONE)
    display_ts = datetime.now(tz).strftime("%Y-%m-%d %H:%M")
    body = f"# {display_title}\n\n{new_content}\n\n---\n*Last edited by Friday · {display_ts}*\n"

    service.files().update(
        fileId=f["id"],
        media_body=MediaIoBaseUpload(
            io.BytesIO(body.encode("utf-8")), mimetype="text/plain", resumable=False
        ),
    ).execute()
    return f"Updated note: {display_title}"


def delete_note(title_query: str) -> str:
    """Delete a note by partial title match."""
    service = _get_service()
    folder_id = _get_friday_folder_id(service)

    result = service.files().list(
        q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id, name)",
        pageSize=50,
    ).execute()
    matches = [f for f in result.get("files", []) if title_query.lower() in f["name"].lower()]

    if not matches:
        return f"No note found matching '{title_query}'."
    if len(matches) > 1:
        names = ", ".join(_strip_timestamp(f["name"]) for f in matches[:4])
        return f"Multiple notes match '{title_query}': {names}. Be more specific."

    f = matches[0]
    display_title = _strip_timestamp(f["name"])
    service.files().delete(fileId=f["id"]).execute()
    return f"Deleted note: {display_title}"


def list_vault_tree() -> dict:
    """Return the full Q_obsidian vault as a nested tree for the dashboard."""
    service = _get_service()
    vault_name = settings.GDRIVE_VAULT_NAME

    result = service.files().list(
        q=f"name='{vault_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)",
        pageSize=1,
    ).execute()
    vaults = result.get("files", [])
    if not vaults:
        raise RuntimeError(f"Vault folder '{vault_name}' not found.")
    vault_id = vaults[0]["id"]

    def recurse(folder_id: str, parent_path: str) -> list:
        res = service.files().list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name, mimeType, modifiedTime)",
            orderBy="folder,name",
            pageSize=1000,
        ).execute()
        items = []
        for f in res.get("files", []):
            if f["mimeType"] == "application/vnd.google-apps.folder":
                child_path = f"{parent_path}/{f['name']}" if parent_path else f["name"]
                items.append({
                    "type": "folder",
                    "name": f["name"],
                    "path": child_path,
                    "children": recurse(f["id"], child_path),
                })
            else:
                name_no_ext = f["name"].removesuffix(".md")
                rel_path = f"{parent_path}/{name_no_ext}" if parent_path else name_no_ext
                items.append({
                    "type": "file",
                    "name": name_no_ext,
                    "path": rel_path,
                    "modifiedTime": f["modifiedTime"],
                })
        return items

    return {"tree": recurse(vault_id, ""), "vaultName": vault_name}


def search_vault(query: str, max_results: int = 5) -> str:
    """Search the entire Q_obsidian vault (all folders) by keyword."""
    keywords = [kw.lower() for kw in query.split() if len(kw) > 2]
    if not keywords:
        return "Please provide a search term."

    service = _get_service()
    vault_name = settings.GDRIVE_VAULT_NAME

    result = service.files().list(
        q=f"name='{vault_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id)",
        pageSize=1,
    ).execute()
    vaults = result.get("files", [])
    if not vaults:
        return f"Vault folder '{vault_name}' not found."
    vault_id = vaults[0]["id"]

    seen: dict[str, dict] = {}
    for kw in keywords[:3]:
        safe_kw = kw.replace("'", "\\'")
        result = service.files().list(
            q=(
                f"'{vault_id}' in parents "
                f"and fullText contains '{safe_kw}' "
                f"and mimeType != 'application/vnd.google-apps.folder' "
                f"and trashed=false"
            ),
            fields="files(id, name, modifiedTime)",
            orderBy="modifiedTime desc",
            pageSize=20,
        ).execute()
        for f in result.get("files", []):
            if f["id"] not in seen:
                seen[f["id"]] = f

    if not seen:
        return f"No vault notes found matching '{query}'."

    files = sorted(seen.values(), key=lambda x: x["modifiedTime"], reverse=True)[:max_results]
    lines = [f"Found {len(files)} vault note(s) for '{query}':\n"]
    for f in files:
        content = _read_file_content(service, f["id"])
        snippet_lines = [
            ln for ln in content.splitlines()
            if ln.strip() and not ln.startswith("#") and not ln.startswith("---")
        ]
        snippet = " ".join(snippet_lines)[:200]
        lines.append(f"— {_strip_timestamp(f['name'])}\n  {snippet}{'…' if len(snippet) == 200 else ''}\n")

    return "\n".join(lines).strip()


# ─── Internal ─────────────────────────────────────────────────────────────────

def _read_file_content(service, file_id: str) -> str:
    try:
        request = service.files().get_media(fileId=file_id)
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buf.getvalue().decode("utf-8", errors="replace")
    except Exception as e:
        return f"[Error reading file: {e}]"
