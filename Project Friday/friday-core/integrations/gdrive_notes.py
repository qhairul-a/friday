"""
Google Drive-based notes integration for Friday.
Drop-in replacement for integrations/obsidian.py.

Notes are stored as .md files inside the 'Friday' subfolder of your Obsidian
vault folder in Google Drive (e.g. Q _obsidian/Friday/).
Files stay fully compatible with the Obsidian app.
"""

import io
import os
import re
from datetime import datetime
from zoneinfo import ZoneInfo


# ─── Auth ─────────────────────────────────────────────────────────────────────

def _get_service():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET_FILE", "")
    token_file = os.environ.get(
        "GDRIVE_NOTES_TOKEN_FILE",
        os.path.join(os.path.dirname(client_secret), "gdrive_notes_token.json")
        if client_secret else "gdrive_notes_token.json",
    )

    if not os.path.exists(token_file):
        raise RuntimeError(
            f"Google Drive not authorized for notes. Run:\n"
            f"  python scripts/authorize_gdrive_notes.py\n"
            f"Expected token file: {token_file}"
        )

    scopes = ["https://www.googleapis.com/auth/drive"]
    creds = Credentials.from_authorized_user_file(token_file, scopes)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(token_file, "w") as f:
            f.write(creds.to_json())

    return build("drive", "v3", credentials=creds)


# ─── Folder discovery ─────────────────────────────────────────────────────────

def _get_friday_folder_id(service) -> str:
    """
    Returns the Google Drive folder ID for the Friday notes folder.
    Checks GDRIVE_NOTES_FOLDER_ID env var first (fast path).
    Otherwise discovers it by searching for the vault → Friday subfolder.
    Prints the ID so the user can save it to .env for future runs.
    """
    folder_id = os.environ.get("GDRIVE_NOTES_FOLDER_ID", "").strip()
    if folder_id:
        return folder_id

    vault_name = os.environ.get("GDRIVE_VAULT_NAME", "Q _obsidian")

    # Find the vault folder
    result = service.files().list(
        q=f"name='{vault_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)",
        pageSize=5,
    ).execute()
    vault_folders = result.get("files", [])
    if not vault_folders:
        raise RuntimeError(
            f"Google Drive folder '{vault_name}' not found. "
            f"Check GDRIVE_VAULT_NAME in your .env."
        )
    vault_id = vault_folders[0]["id"]

    # Find or create Friday subfolder
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
        # Create Friday folder inside vault
        meta = {
            "name": "Friday",
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [vault_id],
        }
        folder = service.files().create(body=meta, fields="id").execute()
        friday_id = folder["id"]
        print(f"[gdrive_notes] Created Friday folder in '{vault_name}'.")

    print(
        f"[gdrive_notes] Friday folder ID: {friday_id}\n"
        f"  Add to .env for faster startup:\n"
        f"  GDRIVE_NOTES_FOLDER_ID={friday_id}"
    )
    return friday_id


# ─── Public API ───────────────────────────────────────────────────────────────

def _safe_filename(text: str) -> str:
    return re.sub(r'[<>:"/\\|?*\n\r]', "", text).strip()[:50]


def write_note(title: str, content: str) -> str:
    """Upload a new markdown note to the Friday folder in Google Drive."""
    from googleapiclient.http import MediaIoBaseUpload

    tz = ZoneInfo(os.environ.get("TIMEZONE", "Asia/Singapore"))
    now = datetime.now(tz)
    timestamp_str = now.strftime("%Y-%m-%d %H%M")
    display_ts = now.strftime("%Y-%m-%d %H:%M")

    safe_title = _safe_filename(title)
    filename = f"{timestamp_str} {safe_title}.md"
    body = f"# {title}\n\n{content}\n\n---\n*Captured by Friday · {display_ts}*\n"

    service = _get_service()
    folder_id = _get_friday_folder_id(service)

    file_meta = {"name": filename, "parents": [folder_id]}
    media = MediaIoBaseUpload(
        io.BytesIO(body.encode("utf-8")),
        mimetype="text/plain",
        resumable=False,
    )
    service.files().create(body=file_meta, media_body=media, fields="id").execute()
    return filename


def list_notes(limit: int = 10) -> str:
    """List recent notes in the Friday folder."""
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
        display_title = re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", f["name"].removesuffix(".md"))
        mod_date = f["modifiedTime"][:10]
        lines.append(f"— {display_title} (saved {mod_date})")
    return "\n".join(lines)


def _find_note(service, folder_id: str, title_query: str) -> list:
    """Find notes by partial title match."""
    result = service.files().list(
        q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id, name)",
        pageSize=50,
    ).execute()
    files = result.get("files", [])
    return [f for f in files if title_query.lower() in f["name"].lower()]


def edit_note(title_query: str, new_content: str) -> str:
    """Update the content of an existing note by partial title match."""
    from googleapiclient.http import MediaIoBaseUpload

    service = _get_service()
    folder_id = _get_friday_folder_id(service)
    matches = _find_note(service, folder_id, title_query)

    if not matches:
        return f"No note found matching '{title_query}'."
    if len(matches) > 1:
        names = ", ".join(
            re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", f["name"].removesuffix(".md"))
            for f in matches[:3]
        )
        return f"Multiple notes match '{title_query}': {names}. Please be more specific."

    f = matches[0]
    display_title = re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", f["name"].removesuffix(".md"))
    tz = ZoneInfo(os.environ.get("TIMEZONE", "Asia/Singapore"))
    display_ts = datetime.now(tz).strftime("%Y-%m-%d %H:%M")
    body = f"# {display_title}\n\n{new_content}\n\n---\n*Last edited by Friday · {display_ts}*\n"

    media = MediaIoBaseUpload(
        io.BytesIO(body.encode("utf-8")),
        mimetype="text/plain",
        resumable=False,
    )
    service.files().update(fileId=f["id"], media_body=media).execute()
    return f"Updated note: {display_title}"


def delete_note(title_query: str) -> str:
    """Delete a note by partial title match."""
    service = _get_service()
    folder_id = _get_friday_folder_id(service)
    matches = _find_note(service, folder_id, title_query)

    if not matches:
        return f"No note found matching '{title_query}'."
    if len(matches) > 1:
        names = ", ".join(
            re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", f["name"].removesuffix(".md"))
            for f in matches[:3]
        )
        return f"Multiple notes match '{title_query}': {names}. Please be more specific."

    f = matches[0]
    display_title = re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", f["name"].removesuffix(".md"))
    service.files().delete(fileId=f["id"]).execute()
    return f"Deleted note: {display_title}"


def _get_vault_folder_id(service) -> str:
    """Returns the Drive folder ID for the root Obsidian vault (e.g. 'Q _obsidian')."""
    vault_name = os.environ.get("GDRIVE_VAULT_NAME", "Q _obsidian")
    result = service.files().list(
        q=f"name='{vault_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)",
        pageSize=5,
    ).execute()
    folders = result.get("files", [])
    if not folders:
        raise RuntimeError(
            f"Vault folder '{vault_name}' not found. Check GDRIVE_VAULT_NAME in .env."
        )
    return folders[0]["id"]


def search_vault(query: str, max_results: int = 5) -> str:
    """Search the entire Obsidian vault (all folders) using Google Drive full-text search."""
    from googleapiclient.http import MediaIoBaseDownload

    keywords = [kw.lower() for kw in query.split() if len(kw) > 2]
    if not keywords:
        return "Please provide a search term."

    service = _get_service()
    vault_id = _get_vault_folder_id(service)

    seen: dict[str, dict] = {}

    # Pass 1: search within the vault root's direct children (works for flat vaults)
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

    # Pass 2 (fallback): Drive-wide .md search if vault is nested/no results from pass 1
    if not seen:
        for kw in keywords[:2]:
            safe_kw = kw.replace("'", "\\'")
            result = service.files().list(
                q=(
                    f"fullText contains '{safe_kw}' "
                    f"and name contains '.md' "
                    f"and trashed=false"
                ),
                fields="files(id, name, modifiedTime)",
                orderBy="modifiedTime desc",
                pageSize=15,
            ).execute()
            for f in result.get("files", []):
                if f["id"] not in seen:
                    seen[f["id"]] = f

    if not seen:
        return f"No notes found in vault matching '{query}'."

    files = sorted(seen.values(), key=lambda x: x["modifiedTime"], reverse=True)[:max_results]

    lines = [f"Found {len(files)} vault note(s) for '{query}':\n"]
    for f in files:
        try:
            request = service.files().get_media(fileId=f["id"])
            buf = io.BytesIO()
            downloader = MediaIoBaseDownload(buf, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            content = buf.getvalue().decode("utf-8", errors="replace")
        except Exception:
            content = ""

        snippet_lines = [
            ln for ln in content.splitlines()
            if ln.strip() and not ln.startswith("#") and not ln.startswith("---")
        ]
        snippet = " ".join(snippet_lines)[:200]
        display_title = re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", f["name"].removesuffix(".md"))
        lines.append(f"— {display_title}\n  {snippet}{'…' if len(snippet) == 200 else ''}\n")

    return "\n".join(lines).strip()


def read_vault_file(filename: str) -> str:
    """Read the full content of an Obsidian vault note by partial filename."""
    from googleapiclient.http import MediaIoBaseDownload

    service = _get_service()
    safe = filename.replace("'", "\\'")

    result = service.files().list(
        q=f"name contains '{safe}' and name contains '.md' and trashed=false",
        fields="files(id, name)",
        pageSize=10,
    ).execute()
    files = result.get("files", [])
    matches = [f for f in files if filename.lower() in f["name"].lower()]

    if not matches:
        return f"No vault file found matching '{filename}'."
    if len(matches) > 1:
        names = ", ".join(
            re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", f["name"].removesuffix(".md"))
            for f in matches[:4]
        )
        return f"Multiple files match '{filename}': {names}. Please be more specific."

    f = matches[0]
    try:
        request = service.files().get_media(fileId=f["id"])
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buf.getvalue().decode("utf-8", errors="replace")
    except Exception as e:
        return f"Could not read '{f['name']}': {e}"


def search_notes(query: str, max_results: int = 5) -> str:
    """Search notes in the Friday folder using Google Drive full-text search."""
    from googleapiclient.http import MediaIoBaseDownload

    keywords = [kw.lower() for kw in query.split() if len(kw) > 2]
    if not keywords:
        return "Please provide a search term."

    service = _get_service()
    folder_id = _get_friday_folder_id(service)

    # Collect unique file matches across all keywords
    seen: dict[str, dict] = {}
    for kw in keywords[:3]:  # cap API calls
        # Escape single quotes in keyword for Drive query
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

    # Sort by most recent, cap results
    files = sorted(seen.values(), key=lambda x: x["modifiedTime"], reverse=True)
    files = files[:max_results]

    lines = [f"Found {len(files)} note(s) for '{query}':\n"]
    for f in files:
        # Download file content for snippet
        try:
            request = service.files().get_media(fileId=f["id"])
            buf = io.BytesIO()
            downloader = MediaIoBaseDownload(buf, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            content = buf.getvalue().decode("utf-8", errors="replace")
        except Exception:
            content = ""

        # Strip heading and frontmatter for snippet
        snippet_lines = [
            ln for ln in content.splitlines()
            if ln.strip() and not ln.startswith("#") and not ln.startswith("---")
        ]
        snippet = " ".join(snippet_lines)[:150]

        # Clean up display title (remove timestamp prefix)
        display_title = re.sub(r"^\d{4}-\d{2}-\d{2} \d{4} ", "", f["name"].removesuffix(".md"))
        lines.append(f"— {display_title}\n  {snippet}{'…' if len(snippet) == 150 else ''}\n")

    return "\n".join(lines).strip()
