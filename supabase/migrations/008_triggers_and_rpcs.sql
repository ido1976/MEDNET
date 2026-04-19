-- Migration 008: Triggers + RPCs missing from 007_ddl_only
-- Run this in Supabase Studio → SQL Editor

-- ============================================
-- 1. profile_completeness trigger
-- ============================================
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

DROP TRIGGER IF EXISTS trigger_update_profile_completeness ON users;
CREATE TRIGGER trigger_update_profile_completeness
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_profile_completeness();

-- ============================================
-- 2. sync_user_circles trigger
-- ============================================
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_user_circles ON users;
CREATE TRIGGER trigger_sync_user_circles
  AFTER INSERT OR UPDATE OF year_of_study, settlement ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_circles();

-- ============================================
-- 3. link_partner RPC
-- ============================================
CREATE OR REPLACE FUNCTION link_partner(requester_id UUID, accepter_id UUID)
RETURNS VOID AS $$
BEGIN
  IF accepter_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: accepter_id must match authenticated user';
  END IF;

  UPDATE users
    SET partner_user_id = accepter_id
    WHERE id = requester_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
