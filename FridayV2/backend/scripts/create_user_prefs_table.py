"""
One-time script to create the user_prefs table in Supabase.
Run from the backend directory: python scripts/create_user_prefs_table.py
Requires SUPABASE_SERVICE_ROLE_KEY set as an env var.
"""

import os
import sys
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import settings

SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not SERVICE_ROLE_KEY:
    print("ERROR: Set SUPABASE_SERVICE_ROLE_KEY env var (Supabase > Project Settings > API)")
    sys.exit(1)

SQL = """
CREATE TABLE IF NOT EXISTS user_prefs (
  key   text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE user_prefs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='user_prefs' AND policyname='allow all'
  ) THEN
    CREATE POLICY "allow all" ON user_prefs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
"""

project_ref = settings.SUPABASE_URL.split("//")[1].split(".")[0]
mgmt_url = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"

resp = httpx.post(
    mgmt_url,
    headers={
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    },
    json={"query": SQL},
    timeout=30,
)

if resp.status_code == 200:
    print("✓ user_prefs table created.")
else:
    print(f"ERROR {resp.status_code}: {resp.text}")
    print("\nAlternative: paste the following SQL into Supabase > SQL Editor:")
    print(SQL)
