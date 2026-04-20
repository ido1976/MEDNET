-- Extend pending_actions action_type to support apartment relevance checks
ALTER TABLE pending_actions DROP CONSTRAINT IF EXISTS pending_actions_action_type_check;
ALTER TABLE pending_actions ADD CONSTRAINT pending_actions_action_type_check
  CHECK (action_type IN ('form','survey','profile_update','rsvp','document','apartment_check'));

-- RPC callable by authenticated users (SECURITY DEFINER bypasses INSERT RLS)
CREATE OR REPLACE FUNCTION create_apartment_check_action(
  p_apartment_id UUID,
  p_address TEXT,
  p_available_from DATE
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Remove any existing pending_action for this apartment (idempotent)
  DELETE FROM pending_actions
  WHERE user_id = auth.uid()
    AND action_type = 'apartment_check'
    AND (metadata->>'apartment_id')::TEXT = p_apartment_id::TEXT;

  -- Create new check: due 7 days before available_from
  INSERT INTO pending_actions
    (user_id, action_type, title, description, metadata, status, due_date)
  VALUES (
    auth.uid(),
    'apartment_check',
    'בדיקת רלוונטיות דירה',
    'תאריך הכניסה לדירה ב-' || p_address || ' מתקרב. האם המודעה עדיין פעילה?',
    jsonb_build_object(
      'apartment_id', p_apartment_id,
      'address',      p_address,
      'available_from', p_available_from
    ),
    'pending',
    (p_available_from::TIMESTAMPTZ - INTERVAL '7 days')
  );
END;
$$;
