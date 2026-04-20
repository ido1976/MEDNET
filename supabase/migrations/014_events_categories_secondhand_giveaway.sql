-- 014_events_categories_secondhand_giveaway.sql
-- 1. Fixes missing category column on events (migration 004 may not have applied)
-- 2. Adds multi-category support (categories TEXT[]) to events
-- 3. Adds 'giveaway' to secondhand_listings category constraint

-- ── 1. Events columns (idempotent) ───────────────────────────────────────────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category   TEXT    DEFAULT 'כללי';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS categories TEXT[]  DEFAULT '{}';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location   TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS link       TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url  TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ── 2. Secondhand: add giveaway to category constraint ───────────────────────────────
ALTER TABLE public.secondhand_listings
  DROP CONSTRAINT IF EXISTS secondhand_listings_category_check;

ALTER TABLE public.secondhand_listings
  ADD CONSTRAINT secondhand_listings_category_check
  CHECK (category IN ('product', 'service', 'other', 'giveaway'));
