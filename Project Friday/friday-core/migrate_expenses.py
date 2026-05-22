#!/usr/bin/env python
"""One-time migration: Google Sheets expenses → Supabase.

Run from friday-core/:
  python migrate_expenses.py

Safe to re-run — skips rows that already exist (matched on date + description + amount).
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv()

from integrations.sheets import read_expenses, extract_sheet_id, _parse_date, _normalize_category
from integrations.expenses import _client
from profile.storage import load_profile

user_id = os.environ.get("FRIDAY_USER_ID", "default")
profile = load_profile(user_id)
sheet_id = extract_sheet_id(profile.finance.google_sheet_id)

if not sheet_id:
    print("No Google Sheet configured. Exiting.")
    sys.exit(1)

print(f"Reading expenses from sheet {sheet_id}…")
rows = read_expenses(sheet_id)
print(f"Found {len(rows) - 1} rows (excluding header).")

client = _client()

# Fetch existing rows to avoid duplicates
existing = client.table("expenses").select("date,description,amount").eq("user_id", user_id).execute().data
existing_keys = {(r["date"], r["description"], float(r["amount"])) for r in existing}
print(f"{len(existing_keys)} rows already in Supabase.")

to_insert = []
skipped = 0
failed = 0

for i, row in enumerate(rows[1:], start=2):
    if len(row) < 5:
        continue
    try:
        amount = float(str(row[4]).replace(",", "").replace("$", "").strip())
    except ValueError:
        failed += 1
        continue

    parsed = _parse_date(str(row[0]))
    if not parsed:
        print(f"  Row {i}: could not parse date '{row[0]}' — skipping")
        failed += 1
        continue

    date_str = parsed.isoformat()
    category = _normalize_category(row[1])
    description = row[3] if len(row) > 3 else ""
    recorder = row[2] if len(row) > 2 else ""

    key = (date_str, description, round(amount, 2))
    if key in existing_keys:
        skipped += 1
        continue

    to_insert.append({
        "user_id": user_id,
        "date": date_str,
        "category": category,
        "description": description,
        "recorder": recorder,
        "amount": round(amount, 2),
    })

print(f"Inserting {len(to_insert)} new rows, skipping {skipped} duplicates, {failed} unparseable.")

if to_insert:
    # Insert in batches of 100
    for i in range(0, len(to_insert), 100):
        batch = to_insert[i:i + 100]
        client.table("expenses").insert(batch).execute()
        print(f"  Inserted batch {i // 100 + 1} ({len(batch)} rows)")

print("Migration complete.")
