-- Migration 009: user_children table
-- Each child is a separate row with optional name, gender, and age

CREATE TABLE IF NOT EXISTS user_children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  gender TEXT CHECK (gender IN ('male', 'female')),
  age INTEGER CHECK (age >= 0 AND age < 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_children_user ON user_children(user_id);

ALTER TABLE user_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own children" ON user_children
  FOR ALL USING (auth.uid() = user_id);
