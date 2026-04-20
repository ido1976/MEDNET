-- 015_event_rsvps_idempotent.sql
-- Ensures event_rsvps and discussions.event_id exist (migration 004 may not have applied)

-- ── 1. event_rsvps ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  user_id   UUID REFERENCES public.users(id)   ON DELETE CASCADE,
  event_id  UUID REFERENCES public.events(id)  ON DELETE CASCADE,
  status    TEXT DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read RSVPs"      ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can manage own RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can update own RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can delete own RSVPs" ON public.event_rsvps;

CREATE POLICY "Anyone can read RSVPs"
  ON public.event_rsvps FOR SELECT USING (true);
CREATE POLICY "Users can manage own RSVPs"
  ON public.event_rsvps FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own RSVPs"
  ON public.event_rsvps FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own RSVPs"
  ON public.event_rsvps FOR DELETE USING (user_id = auth.uid());

-- ── 2. discussions.event_id & created_at ─────────────────────────────────────────────
ALTER TABLE public.discussions ADD COLUMN IF NOT EXISTS
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.discussions ADD COLUMN IF NOT EXISTS
  created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_discussions_event ON public.discussions(event_id);
