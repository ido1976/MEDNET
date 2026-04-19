-- Migration 007: Security fixes (DDL only — no PL/pgSQL functions)
-- Run this in Supabase SQL Editor

-- 1. Fix RLS on chat_sessions
DROP POLICY IF EXISTS "Users can manage own sessions" ON chat_sessions;
CREATE POLICY "Users can manage own sessions" ON chat_sessions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 2. Fix RLS on chat_messages
DROP POLICY IF EXISTS "Users can manage own messages" ON chat_messages;
CREATE POLICY "Users can manage own messages" ON chat_messages
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 3. FK: chat_interactions.session_id -> chat_sessions
ALTER TABLE chat_interactions
  ADD CONSTRAINT fk_chat_interactions_session
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL;

-- 4. Fix admin circles policy
DROP POLICY IF EXISTS "Admins can manage circles" ON user_circles;
CREATE POLICY "Admins can manage circles" ON user_circles
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- 5. Fix pending_actions UPDATE
DROP POLICY IF EXISTS "Users can update own pending actions" ON pending_actions;
CREATE POLICY "Users can update own pending actions" ON pending_actions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own pending actions" ON pending_actions
  FOR DELETE USING (user_id = auth.uid());

-- 6. Fix notification_preferences UPDATE
DROP POLICY IF EXISTS "Users can update own preferences" ON notification_preferences;
CREATE POLICY "Users can update own preferences" ON notification_preferences
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. medit_usage table (already exists — just ensure index and policy)
CREATE INDEX IF NOT EXISTS idx_medit_usage_user_date ON medit_usage(user_id, created_at DESC);
