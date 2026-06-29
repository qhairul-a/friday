-- Create profile-photos storage bucket (public — URLs are used directly in <img> tags)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow anon to read, insert, and update objects in this bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'anon_read_profile_photos') THEN
    CREATE POLICY "anon_read_profile_photos" ON storage.objects FOR SELECT TO anon
    USING (bucket_id = 'profile-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'anon_upload_profile_photos') THEN
    CREATE POLICY "anon_upload_profile_photos" ON storage.objects FOR INSERT TO anon
    WITH CHECK (bucket_id = 'profile-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'anon_update_profile_photos') THEN
    CREATE POLICY "anon_update_profile_photos" ON storage.objects FOR UPDATE TO anon
    USING (bucket_id = 'profile-photos');
  END IF;
END $$;
