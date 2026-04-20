-- Allow authenticated users to upload/read apartment images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can upload apartment images'
  ) THEN
    CREATE POLICY "Authenticated users can upload apartment images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'apartment-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Public read apartment images'
  ) THEN
    CREATE POLICY "Public read apartment images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'apartment-images');
  END IF;
END $$;
