-- MEDNET Bridges Enhancement Migration
-- Adds: tags system, images, tips, additions with approval, notifications

-- ============================================
-- 1. Bridge Tags (master table)
-- ============================================
CREATE TABLE IF NOT EXISTS bridge_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bridge_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tags" ON bridge_tags
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tags" ON bridge_tags
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Seed default tags
INSERT INTO bridge_tags (name) VALUES
  ('לימודים'), ('קליניקה'), ('מחקר'), ('חברתי'),
  ('ספורט'), ('התנדבות'), ('קריירה'), ('כללי')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. Bridge-Tag Assignments (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS bridge_tag_assignments (
  bridge_id UUID REFERENCES bridges(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES bridge_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (bridge_id, tag_id)
);

ALTER TABLE bridge_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tag assignments" ON bridge_tag_assignments
  FOR SELECT USING (true);

CREATE POLICY "Bridge creators can assign tags" ON bridge_tag_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM bridges WHERE id = bridge_id AND created_by = auth.uid())
  );

CREATE POLICY "Bridge creators can remove tags" ON bridge_tag_assignments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM bridges WHERE id = bridge_id AND created_by = auth.uid())
  );

-- ============================================
-- 3. Bridge Images (up to 3 per bridge)
-- ============================================
CREATE TABLE IF NOT EXISTS bridge_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_id UUID REFERENCES bridges(id) ON DELETE CASCADE,
  image_uri TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bridge_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bridge images" ON bridge_images
  FOR SELECT USING (true);

CREATE POLICY "Bridge creators can add images" ON bridge_images
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM bridges WHERE id = bridge_id AND created_by = auth.uid())
  );

CREATE POLICY "Bridge creators can remove images" ON bridge_images
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM bridges WHERE id = bridge_id AND created_by = auth.uid())
  );

CREATE INDEX idx_bridge_images_bridge ON bridge_images(bridge_id);

-- ============================================
-- 4. Bridge Tips
-- ============================================
CREATE TABLE IF NOT EXISTS bridge_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_id UUID REFERENCES bridges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bridge_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tips" ON bridge_tips
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add tips" ON bridge_tips
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_bridge_tips_bridge ON bridge_tips(bridge_id);

-- ============================================
-- 5. Bridge Tip Likes
-- ============================================
CREATE TABLE IF NOT EXISTS bridge_tip_likes (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tip_id UUID REFERENCES bridge_tips(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tip_id)
);

ALTER TABLE bridge_tip_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tip likes" ON bridge_tip_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like tips" ON bridge_tip_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unlike tips" ON bridge_tip_likes
  FOR DELETE USING (user_id = auth.uid());

-- Trigger to update likes_count
CREATE OR REPLACE FUNCTION update_tip_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE bridge_tips SET likes_count = likes_count + 1 WHERE id = NEW.tip_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE bridge_tips SET likes_count = likes_count - 1 WHERE id = OLD.tip_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tip_likes
  AFTER INSERT OR DELETE ON bridge_tip_likes
  FOR EACH ROW EXECUTE FUNCTION update_tip_likes_count();

-- ============================================
-- 6. Bridge Additions (with approval flow)
-- ============================================
CREATE TABLE IF NOT EXISTS bridge_additions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_id UUID REFERENCES bridges(id) ON DELETE CASCADE,
  suggested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  link TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bridge_additions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved additions" ON bridge_additions
  FOR SELECT USING (
    status = 'approved'
    OR suggested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM bridges WHERE id = bridge_id AND created_by = auth.uid())
  );

CREATE POLICY "Authenticated users can suggest additions" ON bridge_additions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Bridge creators can review additions" ON bridge_additions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM bridges WHERE id = bridge_id AND created_by = auth.uid())
  );

CREATE INDEX idx_bridge_additions_bridge ON bridge_additions(bridge_id);
CREATE INDEX idx_bridge_additions_status ON bridge_additions(status);

-- ============================================
-- 7. Notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('addition_pending', 'addition_approved', 'addition_rejected')),
  reference_id UUID,
  bridge_id UUID REFERENCES bridges(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can mark own notifications as read" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user ON notifications(user_id, read);

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
