-- MEDNET Database Schema
-- All tables with RLS enabled

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  year_of_study INTEGER,
  avatar_url TEXT,
  interests TEXT[] DEFAULT '{}',
  invite_token TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'admin', 'moderator')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Bridges table
CREATE TABLE IF NOT EXISTS bridges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  parent_id UUID REFERENCES bridges(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rating_avg NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bridges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active bridges" ON bridges
  FOR SELECT USING (status = 'active' OR created_by = auth.uid());

CREATE POLICY "Authenticated users can create bridges" ON bridges
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can update their bridges" ON bridges
  FOR UPDATE USING (created_by = auth.uid());

-- Discussions table
CREATE TABLE IF NOT EXISTS discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  bridge_id UUID REFERENCES bridges(id) ON DELETE CASCADE,
  tag TEXT DEFAULT 'כללי',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  participants_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read discussions" ON discussions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create discussions" ON discussions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can update their discussions" ON discussions
  FOR UPDATE USING (created_by = auth.uid());

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID REFERENCES discussions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read messages" ON messages
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  bridge_id UUID REFERENCES bridges(id) ON DELETE SET NULL,
  date TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read events" ON events
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create events" ON events
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Apartments table
CREATE TABLE IF NOT EXISTS apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  price NUMERIC NOT NULL,
  rooms INTEGER NOT NULL,
  available_from DATE NOT NULL,
  landlord_rating NUMERIC DEFAULT 0,
  description TEXT DEFAULT '',
  contact_user_id UUID REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read apartments" ON apartments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create apartments" ON apartments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update their apartments" ON apartments
  FOR UPDATE USING (contact_user_id = auth.uid());

CREATE POLICY "Owners can delete their apartments" ON apartments
  FOR DELETE USING (contact_user_id = auth.uid());

-- Rides table
CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  seats INTEGER NOT NULL DEFAULT 1,
  price NUMERIC DEFAULT 0,
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rides" ON rides
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create rides" ON rides
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Drivers can update their rides" ON rides
  FOR UPDATE USING (driver_id = auth.uid());

CREATE POLICY "Drivers can delete their rides" ON rides
  FOR DELETE USING (driver_id = auth.uid());

-- Prices table
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  reliability_score NUMERIC DEFAULT 50
);

ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read prices" ON prices
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can report prices" ON prices
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Direct Messages table
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their messages" ON direct_messages
  FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can send messages" ON direct_messages
  FOR INSERT WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Recipients can mark as read" ON direct_messages
  FOR UPDATE USING (to_user_id = auth.uid());

-- User Tags table
CREATE TABLE IF NOT EXISTS user_tags (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  discussion_id UUID REFERENCES discussions(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, discussion_id)
);

ALTER TABLE user_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tags" ON user_tags
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their tags" ON user_tags
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their tags" ON user_tags
  FOR DELETE USING (user_id = auth.uid());

-- Bridge Ratings table
CREATE TABLE IF NOT EXISTS bridge_ratings (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bridge_id UUID REFERENCES bridges(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  PRIMARY KEY (user_id, bridge_id)
);

ALTER TABLE bridge_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ratings" ON bridge_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can rate bridges" ON bridge_ratings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their ratings" ON bridge_ratings
  FOR UPDATE USING (user_id = auth.uid());

-- Community Questions table
CREATE TABLE IF NOT EXISTS community_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  asked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read questions" ON community_questions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can ask questions" ON community_questions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Askers can update their questions" ON community_questions
  FOR UPDATE USING (asked_by = auth.uid());

-- Invite tokens table for invite-only registration
CREATE TABLE IF NOT EXISTS invite_tokens (
  token TEXT PRIMARY KEY,
  created_by UUID REFERENCES users(id),
  used_by UUID REFERENCES users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage tokens" ON invite_tokens
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Anyone can validate tokens" ON invite_tokens
  FOR SELECT USING (used_by IS NULL);

-- MEDIT usage tracking for rate limiting
CREATE TABLE IF NOT EXISTS medit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE medit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own usage" ON medit_usage
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Edge function can insert usage" ON medit_usage
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_medit_usage_user_date ON medit_usage(user_id, created_at);

-- Indexes for performance
CREATE INDEX idx_bridges_parent ON bridges(parent_id);
CREATE INDEX idx_discussions_bridge ON discussions(bridge_id);
CREATE INDEX idx_messages_discussion ON messages(discussion_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_bridge ON events(bridge_id);
CREATE INDEX idx_apartments_price ON apartments(price);
CREATE INDEX idx_rides_datetime ON rides(date_time);
CREATE INDEX idx_prices_category ON prices(category);
CREATE INDEX idx_dm_users ON direct_messages(from_user_id, to_user_id);
CREATE INDEX idx_dm_created ON direct_messages(created_at DESC);
CREATE INDEX idx_community_q_status ON community_questions(status);

-- Function to update bridge rating average
CREATE OR REPLACE FUNCTION update_bridge_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bridges
  SET rating_avg = (
    SELECT COALESCE(AVG(rating), 0)
    FROM bridge_ratings
    WHERE bridge_id = NEW.bridge_id
  )
  WHERE id = NEW.bridge_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bridge_rating
  AFTER INSERT OR UPDATE ON bridge_ratings
  FOR EACH ROW EXECUTE FUNCTION update_bridge_rating();

-- Function to update discussion participant count and last message
CREATE OR REPLACE FUNCTION update_discussion_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE discussions
  SET
    last_message_at = NOW(),
    participants_count = (
      SELECT COUNT(DISTINCT user_id)
      FROM messages
      WHERE discussion_id = NEW.discussion_id
    )
  WHERE id = NEW.discussion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_discussion_on_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_discussion_on_message();

-- Enable Realtime for messages and direct_messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
