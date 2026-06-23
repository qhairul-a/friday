CREATE TABLE IF NOT EXISTS child_profiles (
  child_name text PRIMARY KEY CHECK (child_name IN ('qasim', 'muadz')),
  photo_url  text,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO child_profiles (child_name, photo_url)
VALUES ('qasim', NULL), ('muadz', NULL)
ON CONFLICT DO NOTHING;

ALTER TABLE child_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'child_profiles' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON child_profiles FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
