from collections import defaultdict
from datetime import datetime
from zoneinfo import ZoneInfo

from core.config import settings
from integrations.gsheets import (
    _discover_sheet_id,
    _sheet_id_cache,
    _drive,
    _sheets,
    get_all_rows,
    append_row,
    update_row,
    delete_row,
    read_cell,
)

FIXED_SHEET = "master_fixed expenses"
VARIABLE_SHEET = "master_variable expenses"


def _current_month() -> str:
    return datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m")


def _fixed_id() -> str:
    return _discover_sheet_id(FIXED_SHEET)


def _variable_id() -> str:
    return _discover_sheet_id(VARIABLE_SHEET)


def _savings_id() -> str:
    name = "master_savings"
    try:
        return _discover_sheet_id(name)
    except (RuntimeError, Exception):
        meta = {
            "name": name,
            "mimeType": "application/vnd.google-apps.spreadsheet",
            "parents": [settings.FINANCE_FOLDER_ID],
        }
        f = _drive().files().create(body=meta, fields="id").execute()
        sid = f["id"]
        _sheet_id_cache[name] = sid
        _sheets().spreadsheets().values().update(
            spreadsheetId=sid,
            range="A1:D1",
            valueInputOption="RAW",
            body={"values": [["date", "category", "description", "amount"]]},
        ).execute()
        return sid


def _parse_amount(val) -> float:
    """Parse amount that may have a leading $ or commas."""
    if not val:
        return 0.0
    return float(str(val).replace("$", "").replace(",", "").strip())


INCOME_SPREADSHEET_ID = "13A1BMtJKATQNE0VrkfAKZBxiQvPXTSVCzPQXZEBQHZw"


def fetch_income() -> float:
    """Read current monthly income from Google Drive sheet.
    Opens the spreadsheet above, reads the tab named 'Sheet2', cell B1.
    NOTE: if the tab name is not 'Sheet2', update the range string below.
    """
    raw = read_cell(INCOME_SPREADSHEET_ID, "Sheet2!B1")
    return _parse_amount(raw)


def _find_fixed(query: str) -> list[tuple[int, dict]]:
    rows = get_all_rows(_fixed_id())
    return [(i, r) for i, r in enumerate(rows) if query.lower() in r.get("Item", "").lower()]


def _find_variable(query: str, date: str = None) -> list[tuple[int, dict]]:
    rows = get_all_rows(_variable_id())
    matches = [(i, r) for i, r in enumerate(rows) if query.lower() in r.get("Description", "").lower()]
    if date and len(matches) > 1:
        narrowed = [(i, r) for i, r in matches if r.get("Date", "") == date]
        if narrowed:
            matches = narrowed
    return matches


# ─── Fixed expenses ───────────────────────────────────────────────────────────

def list_fixed_expenses() -> str:
    rows = get_all_rows(_fixed_id())
    if not rows:
        return "No fixed expenses found."
    total = sum(_parse_amount(r.get("Cost", 0)) for r in rows)
    cur = settings.CURRENCY
    lines = [f"Fixed expenses ({len(rows)} items):"]
    for r in rows:
        note = f" — {r['Comments']}" if r.get("Comments") else ""
        lines.append(f"• {r['Item']}: {cur} {_parse_amount(r.get('Cost', 0)):.2f}{note}")
    lines.append(f"\nTotal: {cur} {total:.2f}/month")
    return "\n".join(lines)


def add_fixed_expense(item: str, cost: float, comments: str = "") -> str:
    append_row(_fixed_id(), [item, str(cost), comments])
    return f"Added fixed expense: {item} ({settings.CURRENCY} {cost:.2f}/month)"


def edit_fixed_expense(query: str, cost: float = None, comments: str = None) -> str:
    matches = _find_fixed(query)
    if not matches:
        return f"No fixed expense found matching '{query}'."
    if len(matches) > 1:
        names = ", ".join(r["Item"] for _, r in matches[:3])
        return f"Multiple fixed expenses match '{query}': {names}. Be more specific."
    idx, row = matches[0]
    update_row(_fixed_id(), idx, [
        row["Item"],
        str(cost) if cost is not None else row.get("Cost", ""),
        comments if comments is not None else row.get("Comments", ""),
    ])
    return f"Updated fixed expense: {row['Item']}"


def delete_fixed_expense(query: str) -> str:
    matches = _find_fixed(query)
    if not matches:
        return f"No fixed expense found matching '{query}'."
    if len(matches) > 1:
        names = ", ".join(r["Item"] for _, r in matches[:3])
        return f"Multiple fixed expenses match '{query}': {names}. Be more specific."
    idx, row = matches[0]
    delete_row(_fixed_id(), idx)
    return f"Deleted fixed expense: {row['Item']}"


# ─── Variable expenses ────────────────────────────────────────────────────────

def list_variable_expenses(month: str = None) -> str:
    month = month or _current_month()
    rows = [r for r in get_all_rows(_variable_id()) if r.get("Date", "").startswith(month)]
    if not rows:
        return f"No variable expenses found for {month}."
    total = sum(_parse_amount(r.get("Amount", 0)) for r in rows)
    cur = settings.CURRENCY
    lines = [f"Variable expenses for {month} ({len(rows)} entries):"]
    for r in rows:
        lines.append(f"• {r.get('Date')}: [{r.get('Category')}] {r.get('Description')} — {cur} {_parse_amount(r.get('Amount', 0)):.2f}")
    lines.append(f"\nTotal: {cur} {total:.2f}")
    return "\n".join(lines)


def add_variable_expense(date: str, category: str, description: str, amount: float) -> str:
    append_row(_variable_id(), [date, category.strip().capitalize(), description, "Friday", str(amount)])
    return f"Added: {description} — {settings.CURRENCY} {amount:.2f} on {date}"


def edit_variable_expense(
    query: str,
    date: str = None,
    category: str = None,
    description: str = None,
    amount: float = None,
) -> str:
    matches = _find_variable(query, date)
    if not matches:
        return f"No variable expense found matching '{query}'."
    if len(matches) > 1:
        descs = ", ".join(r.get("Description", "") for _, r in matches[:3])
        return f"Multiple expenses match '{query}': {descs}. Be more specific."
    idx, row = matches[0]
    update_row(_variable_id(), idx, [
        date or row.get("Date", ""),
        (category.strip().capitalize() if category else row.get("Category", "")),
        description or row.get("Description", ""),
        row.get("Recorder", "Friday"),
        str(amount) if amount is not None else row.get("Amount", ""),
    ])
    return f"Updated variable expense: {row.get('Description', '')}"


def delete_variable_expense(query: str, date: str = None) -> str:
    matches = _find_variable(query, date)
    if not matches:
        return f"No variable expense found matching '{query}'."
    if len(matches) > 1:
        descs = ", ".join(r.get("Description", "") for _, r in matches[:3])
        return f"Multiple expenses match '{query}': {descs}. Be more specific."
    idx, row = matches[0]
    delete_row(_variable_id(), idx)
    return f"Deleted variable expense: {row.get('Description', '')}"


# ─── Analytics ────────────────────────────────────────────────────────────────

def get_last_variable_expense() -> dict | None:
    """Return the most recent variable expense row, or None if no entries."""
    rows = get_all_rows(_variable_id())
    if not rows:
        return None
    sorted_rows = sorted(rows, key=lambda r: r.get("Date", ""), reverse=True)
    last = sorted_rows[0]
    return {
        "date": last.get("Date", ""),
        "category": last.get("Category", ""),
        "description": last.get("Description", ""),
        "amount": _parse_amount(last.get("Amount", 0)),
    }


def get_financial_summary(month: str = None) -> str:
    month = month or _current_month()
    cur = settings.CURRENCY

    fixed_rows = get_all_rows(_fixed_id())
    fixed_total = sum(_parse_amount(r.get("Cost", 0)) for r in fixed_rows)

    all_variable = get_all_rows(_variable_id())
    month_rows = [r for r in all_variable if r.get("Date", "").startswith(month)]

    # Category totals and percentages
    cat_totals: dict[str, float] = defaultdict(float)
    for r in month_rows:
        try:
            cat_totals[r.get("Category", "Other")] += _parse_amount(r.get("Amount", 0))
        except ValueError:
            pass
    variable_total = sum(cat_totals.values())
    cat_pct = {c: v / variable_total * 100 for c, v in cat_totals.items()} if variable_total else {}

    # Month-over-month totals and counts (last 6 months)
    monthly_totals: dict[str, float] = defaultdict(float)
    monthly_counts: dict[str, int] = defaultdict(int)
    for r in all_variable:
        d = r.get("Date", "")
        if len(d) >= 7:
            m = d[:7]
            try:
                monthly_totals[m] += _parse_amount(r.get("Amount", 0))
                monthly_counts[m] += 1
            except ValueError:
                pass
    recent = sorted(monthly_totals)[-6:]

    # Per-category monthly trends
    cat_monthly: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for r in all_variable:
        d = r.get("Date", "")
        if len(d) >= 7:
            try:
                cat_monthly[r.get("Category", "Other")][d[:7]] += _parse_amount(r.get("Amount", 0))
            except ValueError:
                pass

    count = len(month_rows)
    avg = variable_total / count if count else 0

    lines = [f"Financial Summary — {month}", "=" * 40]
    lines.append(f"\nFixed total:    {cur} {fixed_total:.2f}/month ({len(fixed_rows)} items)")
    lines.append(f"Variable total: {cur} {variable_total:.2f} ({count} entries, avg {cur} {avg:.2f})")
    lines.append(f"Combined:       {cur} {fixed_total + variable_total:.2f}")

    if cat_totals:
        lines.append(f"\nVariable by category ({month}):")
        for cat, amt in sorted(cat_totals.items(), key=lambda x: -x[1]):
            lines.append(f"  {cat}: {cur} {amt:.2f} ({cat_pct[cat]:.1f}%)")

    if recent:
        lines.append(f"\nMonthly variable trend:")
        for m in recent:
            lines.append(f"  {m}: {cur} {monthly_totals[m]:.2f} ({monthly_counts[m]} entries)")

    if cat_monthly and recent:
        lines.append(f"\nCategory trends (last 3 months):")
        last3 = recent[-3:]
        for cat in sorted(cat_monthly):
            parts = [f"{m[-2:]}: {cur}{cat_monthly[cat].get(m, 0):.0f}" for m in last3]
            lines.append(f"  {cat}: {' → '.join(parts)}")

    if fixed_rows:
        lines.append(f"\nFixed expenses:")
        for r in fixed_rows:
            lines.append(f"  {r.get('Item')}: {cur} {_parse_amount(r.get('Cost', 0)):.2f}")

    return "\n".join(lines)
