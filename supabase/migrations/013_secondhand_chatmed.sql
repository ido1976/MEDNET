-- 013_secondhand_chatmed.sql
-- Recreates secondhand_listings if it's missing from remote (migration 004 may have
-- partially failed — version was recorded but table was never created).

-- ── 1. Recreate secondhand_listings if missing ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.secondhand_listings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT DEFAULT '',
  category     TEXT DEFAULT 'product' CHECK (category IN ('product', 'service', 'other')),
  price        NUMERIC,
  images       TEXT[] DEFAULT '{}',
  contact_info TEXT,
  contact_phone TEXT,
  created_by   UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'closed')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Add contact_phone to existing tables (IF NOT EXISTS — idempotent)
ALTER TABLE public.secondhand_listings ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Enable RLS (safe to run even if already enabled)
ALTER TABLE public.secondhand_listings ENABLE ROW LEVEL SECURITY;

-- Policies (drop first so CREATE is idempotent)
DROP POLICY IF EXISTS "Anyone can read active listings" ON public.secondhand_listings;
CREATE POLICY "Anyone can read active listings" ON public.secondhand_listings
  FOR SELECT USING (status = 'active' OR created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can create listings" ON public.secondhand_listings;
CREATE POLICY "Authenticated users can create listings" ON public.secondhand_listings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owners can update their listings" ON public.secondhand_listings;
CREATE POLICY "Owners can update their listings" ON public.secondhand_listings
  FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Owners can delete their listings" ON public.secondhand_listings;
CREATE POLICY "Owners can delete their listings" ON public.secondhand_listings
  FOR DELETE USING (created_by = auth.uid());

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_secondhand_category ON public.secondhand_listings(category);
CREATE INDEX IF NOT EXISTS idx_secondhand_status   ON public.secondhand_listings(status);
CREATE INDEX IF NOT EXISTS idx_secondhand_created  ON public.secondhand_listings(created_at DESC);

-- ── 2. Extend pending_actions for secondhand_check ───────────────────────────────────
ALTER TABLE public.pending_actions DROP CONSTRAINT IF EXISTS pending_actions_action_type_check;
ALTER TABLE public.pending_actions ADD CONSTRAINT pending_actions_action_type_check
  CHECK (action_type IN ('form','survey','profile_update','rsvp','document','apartment_check','secondhand_check'));

-- ── 3. RPC: schedule 30-day relevance check ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_secondhand_check_action(
  p_listing_id UUID,
  p_title TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.pending_actions
  WHERE user_id = auth.uid()
    AND action_type = 'secondhand_check'
    AND (metadata->>'listing_id')::TEXT = p_listing_id::TEXT;

  INSERT INTO public.pending_actions
    (user_id, action_type, title, description, metadata, status, due_date)
  VALUES (
    auth.uid(),
    'secondhand_check',
    'בדיקת רלוונטיות מודעה',
    'פרסמת "' || p_title || '" לפני 30 יום. האם הפריט עדיין למכירה?',
    jsonb_build_object('listing_id', p_listing_id, 'title', p_title),
    'pending',
    NOW() + INTERVAL '30 days'
  );
END;
$$;

-- ── 4. Storage buckets ───────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('secondhand-images', 'secondhand-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read secondhand images"           ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload secondhand images" ON storage.objects;

CREATE POLICY "Public read secondhand images"
  ON storage.objects FOR SELECT USING (bucket_id = 'secondhand-images');
CREATE POLICY "Auth users can upload secondhand images"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'secondhand-images' AND auth.role() = 'authenticated'
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-images', 'event-images', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read event images"           ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload event images" ON storage.objects;

CREATE POLICY "Public read event images"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-images');
CREATE POLICY "Auth users can upload event images"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'event-images' AND auth.role() = 'authenticated'
  );
