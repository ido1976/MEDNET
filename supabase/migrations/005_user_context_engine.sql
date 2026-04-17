-- Migration 005: User Context Engine
-- Adds: enhanced user profile, activity tracking, social graph,
-- smart notifications, chat interactions, tag subscriptions

-- ============================================
-- 1. Enhanced User Profile
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS marital_status TEXT DEFAULT 'single'
  CHECK (marital_status IN ('single', 'in_relationship', 'married'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_children BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS children_ages INTEGER[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS settlement TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{hebrew}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_track TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS graduation_year INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS origin_city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completeness INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ============================================
-- 2. User Tag Subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS user_tag_subscriptions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES bridge_tags(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, tag_id)
);

ALTER TABLE user_tag_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all tag subscriptions" ON user_tag_subscriptions
  FOR SELECT USING (true);

CREATE POLICY "Users can subscribe to tags" ON user_tag_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unsubscribe from tags" ON user_tag_subscriptions
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_user_tag_subs_user ON user_tag_subscriptions(user_id);
CREATE INDEX idx_user_tag_subs_tag ON user_tag_subscriptions(tag_id);

-- ============================================
-- 3. User Activity Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('view', 'create', 'react', 'search', 'bookmark', 'share')),
  target_type TEXT NOT NULL CHECK (target_type IN ('bridge', 'discussion', 'event', 'ride', 'secondhand', 'apartment', 'price', 'community', 'chat')),
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own activity" ON user_activity
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can log own activity" ON user_activity
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins can read all activity (for analytics)
CREATE POLICY "Admins can read all activity" ON user_activity
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_user_activity_user ON user_activity(user_id, created_at DESC);
CREATE INDEX idx_user_activity_target ON user_activity(target_type, target_id);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type, created_at DESC);

-- ============================================
-- 4. User Search History
-- ============================================
CREATE TABLE IF NOT EXISTS user_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  context TEXT CHECK (context IN ('bridges', 'discussions', 'secondhand', 'chat', 'events', 'rides', 'apartments', 'prices', 'global')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own search history" ON user_search_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can log own searches" ON user_search_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_search_history_user ON user_search_history(user_id, created_at DESC);

-- ============================================
-- 5. Social Graph Enhancement — Friendships
-- ============================================
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS relationship_type TEXT DEFAULT 'friend'
  CHECK (relationship_type IN ('friend', 'partner', 'family', 'study_buddy'));

-- ============================================
-- 6. User Circles
-- ============================================
CREATE TABLE IF NOT EXISTS user_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  circle_type TEXT NOT NULL CHECK (circle_type IN ('year_group', 'settlement', 'interest', 'custom')),
  auto_generated BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_circles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read circles" ON user_circles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create custom circles" ON user_circles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auto_generated = false);

-- Admins can create any circles (including auto-generated)
CREATE POLICY "Admins can manage circles" ON user_circles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TABLE IF NOT EXISTS user_circle_members (
  circle_id UUID NOT NULL REFERENCES user_circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (circle_id, user_id)
);

ALTER TABLE user_circle_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read circle members" ON user_circle_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can join circles" ON user_circle_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave circles" ON user_circle_members
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX idx_circle_members_circle ON user_circle_members(circle_id);
CREATE INDEX idx_circle_members_user ON user_circle_members(user_id);
CREATE INDEX idx_circles_type ON user_circles(circle_type);

-- ============================================
-- 7. Notification Preferences
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'new_bridge', 'new_event', 'discussion_update', 'form_reminder',
    'chat_suggestion', 'friend_request', 'content_reaction', 'system'
  )),
  enabled BOOLEAN DEFAULT true,
  channel TEXT DEFAULT 'in_app' CHECK (channel IN ('in_app', 'push', 'email')),
  PRIMARY KEY (user_id, notification_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can set own preferences" ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own preferences" ON notification_preferences
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 8. Pending Actions
-- ============================================
CREATE TABLE IF NOT EXISTS pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('form', 'survey', 'profile_update', 'rsvp', 'document')),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed', 'expired')),
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pending actions" ON pending_actions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own pending actions" ON pending_actions
  FOR UPDATE USING (user_id = auth.uid());

-- Admins can create pending actions for any user
CREATE POLICY "Admins can create pending actions" ON pending_actions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can read all pending actions
CREATE POLICY "Admins can read all pending actions" ON pending_actions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_pending_actions_user ON pending_actions(user_id, status);
CREATE INDEX idx_pending_actions_due ON pending_actions(due_date) WHERE status = 'pending';

-- ============================================
-- 9. Chat Interactions (Community FAQ Foundation)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  topic_tags TEXT[] DEFAULT '{}',
  response_summary TEXT,
  response_helpful BOOLEAN,
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat interactions" ON chat_interactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own chat interactions" ON chat_interactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own chat interactions" ON chat_interactions
  FOR UPDATE USING (user_id = auth.uid());

-- Admins can read all for analytics
CREATE POLICY "Admins can read all chat interactions" ON chat_interactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_chat_interactions_user ON chat_interactions(user_id, created_at DESC);
CREATE INDEX idx_chat_interactions_session ON chat_interactions(session_id);
CREATE INDEX idx_chat_interactions_topics ON chat_interactions USING GIN(topic_tags);

-- ============================================
-- 10. Profile Completeness Function
-- ============================================
CREATE OR REPLACE FUNCTION calculate_profile_completeness(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  total_fields INTEGER := 10;
  u RECORD;
  tag_count INTEGER;
BEGIN
  SELECT * INTO u FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Check each field (10 points each = 100 total)
  IF u.full_name IS NOT NULL AND u.full_name != '' THEN score := score + 10; END IF;
  IF u.avatar_url IS NOT NULL AND u.avatar_url != '' THEN score := score + 10; END IF;
  IF u.year_of_study IS NOT NULL THEN score := score + 10; END IF;
  IF u.bio IS NOT NULL AND u.bio != '' THEN score := score + 10; END IF;
  IF u.settlement IS NOT NULL AND u.settlement != '' THEN score := score + 10; END IF;
  IF u.academic_track IS NOT NULL AND u.academic_track != '' THEN score := score + 10; END IF;
  IF u.phone IS NOT NULL AND u.phone != '' THEN score := score + 10; END IF;
  IF u.origin_city IS NOT NULL AND u.origin_city != '' THEN score := score + 10; END IF;
  IF array_length(u.interests, 1) > 0 THEN score := score + 10; END IF;

  -- Check tag subscriptions
  SELECT COUNT(*) INTO tag_count FROM user_tag_subscriptions WHERE user_id = p_user_id;
  IF tag_count > 0 THEN score := score + 10; END IF;

  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update profile_completeness on user update
CREATE OR REPLACE FUNCTION update_profile_completeness()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_completeness := calculate_profile_completeness(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profile_completeness
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_profile_completeness();

-- ============================================
-- 11. Auto-generate Circles on Profile Update
-- ============================================
CREATE OR REPLACE FUNCTION sync_user_circles()
RETURNS TRIGGER AS $$
DECLARE
  circle_id_var UUID;
BEGIN
  -- Year group circle
  IF NEW.year_of_study IS NOT NULL THEN
    -- Find or create the year group circle
    SELECT id INTO circle_id_var FROM user_circles
      WHERE circle_type = 'year_group'
      AND name = 'שנתון ' || NEW.year_of_study::TEXT
      AND auto_generated = true;

    IF circle_id_var IS NULL THEN
      INSERT INTO user_circles (name, circle_type, auto_generated)
        VALUES ('שנתון ' || NEW.year_of_study::TEXT, 'year_group', true)
        RETURNING id INTO circle_id_var;
    END IF;

    INSERT INTO user_circle_members (circle_id, user_id)
      VALUES (circle_id_var, NEW.id)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Settlement circle
  IF NEW.settlement IS NOT NULL AND NEW.settlement != '' THEN
    SELECT id INTO circle_id_var FROM user_circles
      WHERE circle_type = 'settlement'
      AND name = NEW.settlement
      AND auto_generated = true;

    IF circle_id_var IS NULL THEN
      INSERT INTO user_circles (name, circle_type, auto_generated)
        VALUES (NEW.settlement, 'settlement', true)
        RETURNING id INTO circle_id_var;
    END IF;

    INSERT INTO user_circle_members (circle_id, user_id)
      VALUES (circle_id_var, NEW.id)
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_user_circles
  AFTER INSERT OR UPDATE OF year_of_study, settlement ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_circles();

-- ============================================
-- 12. Expand Notifications Type Check
-- ============================================
-- Drop the old constraint and create a new one with additional types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'addition_pending', 'addition_approved', 'addition_rejected',
    'partner_request', 'partner_accepted',
    'new_relevant_bridge', 'new_relevant_event',
    'pending_action_reminder', 'tag_suggestion',
    'circle_activity'
  ));
