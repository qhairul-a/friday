-- reading_sessions: one row per reading session
CREATE TABLE IF NOT EXISTS reading_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name       text NOT NULL CHECK (child_name IN ('qasim', 'muadz')),
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,
  duration_minutes numeric,
  created_at       timestamptz DEFAULT now()
);

-- screentime_sessions: one row per screen time usage session
CREATE TABLE IF NOT EXISTS screentime_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name            text NOT NULL CHECK (child_name IN ('qasim', 'muadz')),
  started_at            timestamptz NOT NULL,
  ended_at              timestamptz,
  duration_used_minutes numeric,
  created_at            timestamptz DEFAULT now()
);

-- screentime_balance: live wallet balance per child
CREATE TABLE IF NOT EXISTS screentime_balance (
  child_name      text PRIMARY KEY CHECK (child_name IN ('qasim', 'muadz')),
  balance_minutes numeric NOT NULL DEFAULT 0,
  updated_at      timestamptz DEFAULT now()
);

-- Seed
INSERT INTO screentime_balance (child_name, balance_minutes)
VALUES ('qasim', 0), ('muadz', 0)
ON CONFLICT DO NOTHING;

-- RPC: atomically add minutes to balance
CREATE OR REPLACE FUNCTION increment_balance(p_child text, p_minutes numeric)
RETURNS void LANGUAGE sql AS $$
  UPDATE screentime_balance
  SET balance_minutes = balance_minutes + p_minutes,
      updated_at = now()
  WHERE child_name = p_child;
$$;

-- RPC: atomically set balance to exact value (floor at 0)
CREATE OR REPLACE FUNCTION set_balance(p_child text, p_minutes numeric)
RETURNS void LANGUAGE sql AS $$
  UPDATE screentime_balance
  SET balance_minutes = GREATEST(0, p_minutes),
      updated_at = now()
  WHERE child_name = p_child;
$$;

-- RLS: enable with permissive anon policies (family app, no sensitive data)
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE screentime_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE screentime_balance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reading_sessions' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON reading_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'screentime_sessions' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON screentime_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'screentime_balance' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON screentime_balance FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
