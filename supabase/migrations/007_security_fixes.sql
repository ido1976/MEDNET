-- Migration 007: Security fixes from code review
-- Fixes: RLS WITH CHECK gaps, missing FK on chat_interactions.session_id,
--        profile_completeness trigger on INSERT, pending_actions DELETE policy

-- ============================================
-- 1. Fix RLS on chat_sessions (explicit WITH CHECK)
-- ============================================
DROP POLICY IF EXISTS "Users can manage own sessions" ON chat_sessions;

CREATE POLICY "Users can manage own sessions" ON chat_sessions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 2. Fix RLS on chat_messages (explicit WITH CHECK)
-- ============================================
DROP POLICY IF EXISTS "Users can manage own messages" ON chat_messages;

CREATE POLICY "Users can manage own messages" ON chat_messages
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 3. Add FK from chat_interactions.session_id → chat_sessions
-- ============================================
ALTER TABLE chat_interactions
  ADD CONSTRAINT fk_chat_interactions_session
  FOREIGN KEY (session_id)
  REFERENCES chat_sessions(id)
  ON DELETE SET NULL;

-- ============================================
-- 4. Fix admin circles policy (explicit WITH CHECK)
-- ============================================
DROP POLICY IF EXISTS "Admins can manage circles" ON user_circles;

CREATE POLICY "Admins can manage circles" ON user_circles
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 5. Fix pending_actions UPDATE (add WITH CHECK)
-- ============================================
DROP POLICY IF EXISTS "Users can update own pending actions" ON pending_actions;

CREATE POLICY "Users can update own pending actions" ON pending_actions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Add missing DELETE policy for pending_actions
CREATE POLICY "Users can delete own pending actions" ON pending_actions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- 6. Fix notification_preferences UPDATE (add WITH CHECK)
-- ============================================
DROP POLICY IF EXISTS "Users can update own preferences" ON notification_preferences;

CREATE POLICY "Users can update own preferences" ON notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- 7. Fix profile_completeness trigger to also fire on INSERT
-- ============================================
DROP TRIGGER IF EXISTS trigger_update_profile_completeness ON users;

-- Fix the function to use NEW.* directly instead of re-selecting
CREATE OR REPLACE FUNCTION calculate_profile_completeness_from_row(u users)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  n_tags INTEGER;
BEGIN
  IF u.full_name IS NOT NULL AND u.full_name != '' THEN score := score + 10; END IF;
  IF u.avatar_url IS NOT NULL AND u.avatar_url != '' THEN score := score + 10; END IF;
  IF u.year_of_study IS NOT NULL THEN score := score + 10; END IF;
  IF u.bio IS NOT NULL AND u.bio != '' THEN score := score + 10; END IF;
  IF u.settlement IS NOT NULL AND u.settlement != '' THEN score := score + 10; END IF;
  IF u.academic_track IS NOT NULL AND u.academic_track != '' THEN score := score + 10; END IF;
  IF u.phone IS NOT NULL AND u.phone != '' THEN score := score + 10; END IF;
  IF u.origin_city IS NOT NULL AND u.origin_city != '' THEN score := score + 10; END IF;
  IF array_length(u.interests, 1) > 0 THEN score := score + 10; END IF;

  SELECT COUNT(*) INTO n_tags FROM user_tag_subscriptions WHERE user_id = u.id;
  IF n_tags > 0 THEN score := score + 10; END IF;

  RETURN score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_profile_completeness()
RETURNS TRIGGER AS $$
BEGIN
  NEW.profile_completeness := calculate_profile_completeness_from_row(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now fires on both INSERT and UPDATE
CREATE TRIGGER trigger_update_profile_completeness
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_profile_completeness();

-- ============================================
-- 8. Auto-generate Circles on Profile Update (moved from 005)
-- ============================================
DROP TRIGGER IF EXISTS trigger_sync_user_circles ON users;

CREATE OR REPLACE FUNCTION sync_user_circles()
RETURNS TRIGGER AS $$
DECLARE
  found_circle UUID;
BEGIN
  IF NEW.year_of_study IS NOT NULL THEN
    SELECT id INTO found_circle FROM user_circles
      WHERE circle_type = 'year_group'
      AND name = CONCAT('שנתון ', NEW.year_of_study::TEXT)
      AND auto_generated = true;
    IF found_circle IS NULL THEN
      INSERT INTO user_circles (name, circle_type, auto_generated)
        VALUES (CONCAT('שנתון ', NEW.year_of_study::TEXT), 'year_group', true)
        RETURNING id INTO found_circle;
    END IF;
    INSERT INTO user_circle_members (circle_id, user_id)
      VALUES (found_circle, NEW.id) ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.settlement IS NOT NULL AND NEW.settlement != '' THEN
    SELECT id INTO found_circle FROM user_circles
      WHERE circle_type = 'settlement' AND name = NEW.settlement AND auto_generated = true;
    IF found_circle IS NULL THEN
      INSERT INTO user_circles (name, circle_type, auto_generated)
        VALUES (NEW.settlement, 'settlement', true)
        RETURNING id INTO found_circle;
    END IF;
    INSERT INTO user_circle_members (circle_id, user_id)
      VALUES (found_circle, NEW.id) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_user_circles
  AFTER INSERT OR UPDATE OF year_of_study, settlement ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_circles();

-- ============================================
-- 9. medit_usage table (rate limiting for CHATMED)
-- ============================================
CREATE TABLE IF NOT EXISTS medit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE medit_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own usage" ON medit_usage
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_medit_usage_user_date ON medit_usage(user_id, created_at DESC);

-- ============================================
-- 10. Couple sync RPC: atomically links both users as partners
--    SECURITY DEFINER allows bypassing RLS to update the requester's row
-- ============================================
CREATE OR REPLACE FUNCTION link_partner(requester_id UUID, accepter_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Verify the accepter is the caller (prevents abuse)
  IF accepter_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: accepter_id must match authenticated user';
  END IF;

  -- Update requester's row (the one who sent the original request)
  UPDATE users
    SET partner_user_id = accepter_id
    WHERE id = requester_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
