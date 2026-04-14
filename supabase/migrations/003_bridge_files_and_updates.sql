-- Add updated_at column to bridges
ALTER TABLE bridges ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Bridge files table
CREATE TABLE IF NOT EXISTS bridge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_id UUID NOT NULL REFERENCES bridges(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_uri TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for bridge_files
ALTER TABLE bridge_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read bridge files"
  ON bridge_files FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload files"
  ON bridge_files FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "File uploader or bridge creator can delete files"
  ON bridge_files FOR DELETE USING (
    auth.uid() = uploaded_by
    OR auth.uid() = (SELECT created_by FROM bridges WHERE id = bridge_id)
  );
