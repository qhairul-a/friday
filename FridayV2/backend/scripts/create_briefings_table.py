"""
One-time script to create the briefings table in Supabase.
Run from the backend directory: python scripts/create_briefings_table.py
Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (or passed as env vars).
"""

import os
import sys
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import settings

SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not SERVICE_ROLE_KEY:
    print("ERROR: Set SUPABASE_SERVICE_ROLE_KEY env var (find it in Supabase > Project Settings > API)")
    sys.exit(1)

SQL = """
CREATE TABLE IF NOT EXISTS briefings (
  id         uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text    NOT NULL,
  send_time  text    NOT NULL DEFAULT '07:00',
  enabled    boolean NOT NULL DEFAULT true,
  sections   text[]  NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='briefings' AND policyname='allow all'
  ) THEN
    CREATE POLICY "allow all" ON briefings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO briefings (name, send_time, sections)
SELECT 'Morning Briefing', '07:00', ARRAY['weather','calendar','tasks','routines']
WHERE NOT EXISTS (SELECT 1 FROM briefings WHERE name = 'Morning Briefing');

INSERT INTO briefings (name, send_time, sections)
SELECT 'Evening Recap', '21:00', ARRAY['routines','tasks','finance']
WHERE NOT EXISTS (SELECT 1 FROM briefings WHERE name = 'Evening Recap');
"""

url = f"{settings.SUPABASE_URL}/rest/v1/rpc/exec_sql"
# Supabase doesn't expose an exec_sql RPC by default — use the pg meta endpoint instead
url = f"{settings.SUPABASE_URL.replace('https://', 'https://api.supabase.com/v1/projects/')}"

# Use the Supabase management API
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
    print("✓ briefings table created and seeded.")
else:
    print(f"ERROR {resp.status_code}: {resp.text}")
    print("\nAlternative: paste the following SQL into Supabase > SQL Editor:")
    print(SQL)
