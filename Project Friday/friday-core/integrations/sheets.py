import os
import pickle
from datetime import date, datetime
from collections import defaultdict
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

TOKEN_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "google_token.pickle")


def _service():
    if not os.path.exists(TOKEN_PATH):
        raise RuntimeError("Google auth token not found. Run setup_google_auth.py first.")
    with open(TOKEN_PATH, "rb") as f:
        creds = pickle.load(f)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with open(TOKEN_PATH, "wb") as f:
            pickle.dump(creds, f)
    return build("sheets", "v4", credentials=creds)


def append_expense(sheet_id: str, amount: float, category: str, description: str, expense_date: str | None = None) -> None:
    service = _service()
    try:
        row_date = date.fromisoformat(expense_date).isoformat() if expense_date else date.today().isoformat()
    except ValueError:
        row_date = date.today().isoformat()
    # Column order: Date | Category | S/Q | Description | Price
    values = [[row_date, category, "Friday", description, amount]]
    service.spreadsheets().values().append(
        spreadsheetId=sheet_id,
        range="Expense!A:E",
        valueInputOption="USER_ENTERED",
        body={"values": values},
    ).execute()


def read_expenses(sheet_id: str, range_: str = "Expense!A:E") -> list[list]:
    service = _service()
    result = service.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range=range_,
    ).execute()
    return result.get("values", [])


def extract_sheet_id(url_or_id: str) -> str:
    if "/spreadsheets/d/" in url_or_id:
        return url_or_id.split("/spreadsheets/d/")[1].split("/")[0]
    return url_or_id


def get_finance_context(sheet_id: str) -> str:
    """Read this month's expenses and return a formatted summary for Claude."""
    rows = read_expenses(sheet_id)
    if not rows:
        return "No expense data found in the sheet."

    today = date.today()
    current_month = today.strftime("%Y-%m")
    current_month_label = today.strftime("%B %Y")

    DATE_FORMATS = [
        "%Y-%m-%d",   # 2026-05-21 — Friday's own format, unambiguous
        "%m/%d/%Y",   # 05/21/2026 — Google Sheets default (MM/DD/YYYY)
        "%m/%d/%y",   # 05/21/26
        "%d %b %Y",   # 21 May 2026
        "%d %B %Y",   # 21 May 2026 (full month)
        "%Y/%m/%d",   # 2026/05/21
        "%d/%m/%Y",   # 21/05/2026 — fallback
        "%d-%m-%Y",   # 21-05-2026
    ]

    def parse_date(raw: str) -> date | None:
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(raw.strip(), fmt).date()
            except ValueError:
                continue
        return None

    monthly_rows = []
    all_time_total = 0.0

    for row in rows[1:]:  # skip header row
        if len(row) < 5:
            continue
        row_date, category, recorder, description, price = row[0], row[1], row[2], row[3], row[4]
        try:
            amount = float(str(price).replace(",", "").replace("$", "").strip())
        except ValueError:
            continue
        all_time_total += amount
        parsed = parse_date(str(row_date))
        if parsed and parsed.year == today.year and parsed.month == today.month:
            monthly_rows.append((parsed.isoformat(), category.strip().title(), description, amount))

    if not monthly_rows:
        return f"No expenses recorded for {current_month_label} yet. All-time total: SGD {all_time_total:.2f}."

    month_total = sum(r[3] for r in monthly_rows)
    by_category = defaultdict(float)
    for _, category, _, amount in monthly_rows:
        by_category[category] += amount

    lines = [f"Expenses for {current_month_label} (SGD):"]
    lines.append(f"Total spent: {month_total:.2f}")
    lines.append("Breakdown by category:")
    for cat, total in sorted(by_category.items(), key=lambda x: -x[1]):
        lines.append(f"  {cat}: {total:.2f}")
    lines.append(f"\nRecent transactions ({min(10, len(monthly_rows))} most recent):")
    for row_date, category, description, amount in monthly_rows[-10:]:
        lines.append(f"  {row_date} | {category} | {description} | {amount:.2f}")

    return "\n".join(lines)


_DATE_FORMATS = [
    "%Y-%m-%d",   # 2026-05-21 — Friday's own format, unambiguous
    "%m/%d/%Y",   # 05/21/2026 — Google Sheets default (MM/DD/YYYY)
    "%m/%d/%y",   # 05/21/26
    "%d %b %Y",   # 21 May 2026
    "%d %B %Y",   # 21 May 2026 (full month)
    "%Y/%m/%d",   # 2026/05/21
    "%d/%m/%Y",   # 21/05/2026 — kept last as fallback
    "%d-%m-%Y",   # 21-05-2026
]


def _parse_date(raw: str) -> date | None:
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _normalize_category(raw: str) -> str:
    return raw.strip().title()


def get_finance_summary(sheet_id: str) -> dict:
    """Return expense totals by category for the current month as a structured dict."""
    rows = read_expenses(sheet_id)
    current_month = date.today().strftime("%Y-%m")
    by_category: dict[str, float] = {}
    total = 0.0
    count = 0

    for row in rows[1:]:
        if len(row) < 5:
            continue
        try:
            amount = float(str(row[4]).replace(",", "").replace("$", "").strip())
        except ValueError:
            continue
        parsed = _parse_date(str(row[0]))
        if parsed and parsed.strftime("%Y-%m") == current_month:
            cat = _normalize_category(row[1])
            by_category[cat] = by_category.get(cat, 0) + amount
            total += amount
            count += 1

    return {
        "total": round(total, 2),
        "count": count,
        "avg": round(total / count, 2) if count else 0.0,
        "by_category": {k: round(v, 2) for k, v in by_category.items()},
        "month": current_month,
    }


def get_expense_entries(sheet_id: str, month: str | None = None) -> dict:
    """Return individual expense rows for a given month (YYYY-MM), defaulting to current month."""
    rows = read_expenses(sheet_id)
    target = month or date.today().strftime("%Y-%m")
    entries = []
    total = 0.0
    by_category: dict[str, float] = {}

    for row in rows[1:]:
        if len(row) < 5:
            continue
        try:
            amount = float(str(row[4]).replace(",", "").replace("$", "").strip())
        except ValueError:
            continue
        parsed = _parse_date(str(row[0]))
        if not parsed or parsed.strftime("%Y-%m") != target:
            continue
        cat = _normalize_category(row[1])
        desc = row[3] if len(row) > 3 else ""
        recorder = row[2] if len(row) > 2 else ""
        entries.append({
            "date": parsed.isoformat(),
            "category": cat,
            "description": desc,
            "recorder": recorder,
            "amount": round(amount, 2),
        })
        by_category[cat] = round(by_category.get(cat, 0) + amount, 2)
        total += amount

    entries.sort(key=lambda e: e["date"])
    return {
        "month": target,
        "entries": entries,
        "total": round(total, 2),
        "count": len(entries),
        "by_category": by_category,
    }


def _last_n_months(n: int) -> list[str]:
    """Return the last n calendar months as YYYY-MM strings, oldest first."""
    today = date.today()
    y, m = today.year, today.month
    months = []
    for _ in range(n):
        months.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(months))


def get_multi_month_summary(sheet_id: str, n_months: int = 6) -> list[dict]:
    """Return per-month summaries for the last n_months calendar months, oldest first.

    Only considers months within the last n_months window from today, so old
    sheet data from prior years does not pollute the results.
    """
    rows = read_expenses(sheet_id)
    valid_months = set(_last_n_months(n_months))
    by_month: dict[str, dict] = {m: {"by_category": {}, "total": 0.0, "count": 0} for m in valid_months}

    for row in rows[1:]:
        if len(row) < 5:
            continue
        try:
            amount = float(str(row[4]).replace(",", "").replace("$", "").strip())
        except ValueError:
            continue
        parsed = _parse_date(str(row[0]))
        if not parsed:
            continue
        month_key = parsed.strftime("%Y-%m")
        if month_key not in valid_months:
            continue
        cat = _normalize_category(row[1])
        by_month[month_key]["by_category"][cat] = round(
            by_month[month_key]["by_category"].get(cat, 0) + amount, 2
        )
        by_month[month_key]["total"] += amount
        by_month[month_key]["count"] += 1

    result = []
    for m in sorted(valid_months):
        d = by_month[m]
        cnt = d["count"]
        total = round(d["total"], 2)
        result.append({
            "month": m,
            "total": total,
            "count": cnt,
            "avg": round(total / cnt, 2) if cnt else 0.0,
            "by_category": d["by_category"],
        })
    return result
