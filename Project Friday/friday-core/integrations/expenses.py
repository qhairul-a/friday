from datetime import date
from calendar import monthrange
import os
from supabase import create_client



_supabase = None

def _client():
    global _supabase
    if _supabase is None:
        _supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    return _supabase


def append_expense(user_id: str, amount: float, category: str, description: str,
                   expense_date: str | None = None, recorder: str = "Friday") -> str:
    d = expense_date or date.today().isoformat()
    _client().table("expenses").insert({
        "user_id": user_id,
        "date": d,
        "category": category.strip().title(),
        "description": description,
        "recorder": recorder,
        "amount": round(amount, 2),
    }).execute()
    return f"Logged {category.strip().title()}: {amount:.2f} on {d}"


def get_finance_context(user_id: str, month: str | None = None) -> str:
    """Return a formatted spending summary for Friday to read aloud.

    Args:
        month: YYYY-MM format, e.g. '2026-04'. Defaults to the current month.
    """
    today = date.today()
    if month:
        try:
            y, m = int(month[:4]), int(month[5:7])
        except (ValueError, IndexError):
            y, m = today.year, today.month
    else:
        y, m = today.year, today.month

    month_start = f"{y}-{m:02d}-01"
    month_end = f"{y}-{m:02d}-{monthrange(y, m)[1]:02d}"
    month_label = date(y, m, 1).strftime("%B %Y")

    rows = (
        _client()
        .table("expenses")
        .select("date,category,description,amount")
        .eq("user_id", user_id)
        .gte("date", month_start)
        .lte("date", month_end)
        .execute()
        .data
    )
    if not rows:
        return f"No expenses recorded for {month_label} yet."
    count = len(rows)
    total = round(sum(r["amount"] for r in rows), 2)
    avg = round(total / count, 2)
    by_cat: dict[str, float] = {}
    for r in rows:
        by_cat[r["category"]] = round(by_cat.get(r["category"], 0) + r["amount"], 2)
    lines = [f"Expenses for {month_label}:"]
    lines.append(f"Total: {total:.2f}")
    lines.append(f"Entries: {count}")
    lines.append(f"Average per entry: {avg:.2f}")
    lines.append("By category: " + ", ".join(
        f"{k} {v:.2f}" for k, v in sorted(by_cat.items(), key=lambda x: -x[1])
    ))
    return "\n".join(lines)


def list_expenses(user_id: str, month: str | None = None, limit: int = 10) -> str:
    """List individual expense entries with short IDs for editing or deleting."""
    today = date.today()
    if month:
        try:
            y, m = int(month[:4]), int(month[5:7])
        except (ValueError, IndexError):
            y, m = today.year, today.month
    else:
        y, m = today.year, today.month

    month_start = f"{y}-{m:02d}-01"
    month_end = f"{y}-{m:02d}-{monthrange(y, m)[1]:02d}"
    month_label = date(y, m, 1).strftime("%B %Y")

    rows = (
        _client()
        .table("expenses")
        .select("id,date,category,description,amount")
        .eq("user_id", user_id)
        .gte("date", month_start)
        .lte("date", month_end)
        .order("date", desc=True)
        .limit(limit)
        .execute()
        .data
    )
    if not rows:
        return f"No expenses found for {month_label}."

    lines = [f"Expenses for {month_label} (showing {len(rows)}):"]
    for r in rows:
        short_id = r["id"][:8]
        lines.append(
            f"[{short_id}] {r['date']} — {r['category']}: {r['description']} — {r['amount']:.2f}"
        )
    return "\n".join(lines)


def edit_expense(user_id: str, expense_id: str, amount: float | None = None,
                 category: str | None = None, description: str | None = None,
                 expense_date: str | None = None) -> str:
    """Edit an expense by its short ID (first 8 chars from list_expenses)."""
    rows = _client().table("expenses").select("id,description,amount").eq("user_id", user_id).execute().data
    match = next((r for r in rows if r["id"].startswith(expense_id)), None)
    if not match:
        return f"No expense found with ID '{expense_id}'. Use list_expenses to get valid IDs."

    updates: dict = {}
    if amount is not None:
        updates["amount"] = round(amount, 2)
    if category:
        updates["category"] = category.strip().title()
    if description:
        updates["description"] = description
    if expense_date:
        updates["date"] = expense_date

    if not updates:
        return "Nothing to update — please provide at least one field to change."

    _client().table("expenses").update(updates).eq("id", match["id"]).execute()
    return f"Updated expense '{match['description']}' ({match['amount']:.2f})."


def delete_expense(user_id: str, expense_id: str) -> str:
    """Delete an expense by its short ID (first 8 chars from list_expenses)."""
    rows = _client().table("expenses").select("id,description,amount,date").eq("user_id", user_id).execute().data
    match = next((r for r in rows if r["id"].startswith(expense_id)), None)
    if not match:
        return f"No expense found with ID '{expense_id}'. Use list_expenses to get valid IDs."

    _client().table("expenses").delete().eq("id", match["id"]).execute()
    return f"Deleted expense: {match['description']} ({match['amount']:.2f}) on {match['date']}."
