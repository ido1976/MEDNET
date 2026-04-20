-- Add missing columns to apartments table for full listing board functionality
ALTER TABLE apartments
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS floor INTEGER,
  ADD COLUMN IF NOT EXISTS is_furnished BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_balcony BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_parking BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pets_allowed BOOLEAN DEFAULT false;
