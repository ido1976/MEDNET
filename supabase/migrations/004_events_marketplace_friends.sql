-- Migration 004: Events enhancements, Marketplace, Friends

-- Extend events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'כללי';
ALTER TABLE events ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Event RSVPs
CREATE TABLE IF NOT EXISTS event_rsvps (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read RSVPs" ON event_rsvps
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own RSVPs" ON event_rsvps
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own RSVPs" ON event_rsvps
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own RSVPs" ON event_rsvps
  FOR DELETE USING (user_id = auth.uid());

-- Extend discussions with optional event link
ALTER TABLE discussions ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_discussions_event ON discussions(event_id);

-- Secondhand listings
CREATE TABLE IF NOT EXISTS secondhand_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'product' CHECK (category IN ('product', 'service', 'other')),
  price NUMERIC,
  images TEXT[] DEFAULT '{}',
  contact_info TEXT,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE secondhand_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active listings" ON secondhand_listings
  FOR SELECT USING (status = 'active' OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create listings" ON secondhand_listings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update their listings" ON secondhand_listings
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Owners can delete their listings" ON secondhand_listings
  FOR DELETE USING (created_by = auth.uid());

CREATE INDEX idx_secondhand_category ON secondhand_listings(category);
CREATE INDEX idx_secondhand_status ON secondhand_listings(status);
CREATE INDEX idx_secondhand_created ON secondhand_listings(created_at DESC);

-- Extend users with user_type
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'student' CHECK (user_type IN ('student', 'family_member'));

-- Friendships
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own friendships" ON friendships
  FOR SELECT USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE POLICY "Users can send friend requests" ON friendships
  FOR INSERT WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can update friendships they receive" ON friendships
  FOR UPDATE USING (addressee_id = auth.uid());

CREATE POLICY "Users can delete own friendships" ON friendships
  FOR DELETE USING (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);
