from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/spreadsheets",
]

_sheet_id_cache: dict[str, str] = {}


def _get_creds() -> Credentials:
    if not settings.GDRIVE_TOKEN_FILE.exists():
        raise RuntimeError("Google not authorized. Run: python scripts/authorize_google.py")
    creds = Credentials.from_authorized_user_file(str(settings.GDRIVE_TOKEN_FILE), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(settings.GDRIVE_TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
    return creds


def _sheets():
    return build("sheets", "v4", credentials=_get_creds())


def _drive():
    return build("drive", "v3", credentials=_get_creds())


def _discover_sheet_id(name: str) -> str:
    if name in _sheet_id_cache:
        return _sheet_id_cache[name]
    safe = name.replace("'", "\\'")
    result = _drive().files().list(
        q=f"name='{safe}' and '{settings.FINANCE_FOLDER_ID}' in parents and trashed=false",
        fields="files(id, name)",
        pageSize=5,
    ).execute()
    files = result.get("files", [])
    if not files:
        raise RuntimeError(f"Sheet '{name}' not found in Finance folder.")
    _sheet_id_cache[name] = files[0]["id"]
    return _sheet_id_cache[name]


def get_all_rows(spreadsheet_id: str) -> list[dict]:
    """Return all data rows as list of dicts. Row 1 is headers."""
    result = _sheets().spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range="A:Z",
    ).execute()
    values = result.get("values", [])
    if len(values) < 2:
        return []
    headers = values[0]
    rows = []
    for row in values[1:]:
        while len(row) < len(headers):
            row.append("")
        rows.append(dict(zip(headers, row)))
    return rows


def append_row(spreadsheet_id: str, values: list) -> None:
    _sheets().spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range="A:A",
        valueInputOption="RAW",
        body={"values": [values]},
    ).execute()


def update_row(spreadsheet_id: str, row_index: int, values: list) -> None:
    """Update row at 0-based data index (0 = first data row below header = sheet row 2)."""
    sheet_row = row_index + 2
    _sheets().spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f"A{sheet_row}:Z{sheet_row}",
        valueInputOption="RAW",
        body={"values": [values]},
    ).execute()


def delete_row(spreadsheet_id: str, row_index: int) -> None:
    """Delete row at 0-based data index."""
    meta = _sheets().spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_id = meta["sheets"][0]["properties"]["sheetId"]
    start = row_index + 1  # +1 to skip header (0-indexed: header=0, first data=1)
    _sheets().spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={
            "requests": [{
                "deleteDimension": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "ROWS",
                        "startIndex": start,
                        "endIndex": start + 1,
                    }
                }
            }]
        },
    ).execute()


def read_cell(spreadsheet_id: str, range_: str) -> str:
    """Read a single cell value from any spreadsheet by ID. Returns empty string if not found."""
    result = _sheets().spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_,
    ).execute()
    values = result.get("values", [])
    if values and values[0]:
        return str(values[0][0])
    return ""
