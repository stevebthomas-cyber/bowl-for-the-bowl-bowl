-- Create function to atomically decrement team treasury
-- This prevents race conditions when multiple purchases happen concurrently

CREATE OR REPLACE FUNCTION decrement_treasury(
  p_team_id uuid,
  p_amount integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_treasury integer;
BEGIN
  -- Atomically decrement treasury and return new value
  UPDATE teams
  SET treasury = treasury - p_amount
  WHERE id = p_team_id
  RETURNING treasury INTO v_new_treasury;

  -- Check if treasury went negative (shouldn't happen with validation, but safety check)
  IF v_new_treasury < 0 THEN
    RAISE EXCEPTION 'Insufficient treasury: operation would result in negative balance';
  END IF;

  RETURN v_new_treasury;
END;
$$;

COMMENT ON FUNCTION decrement_treasury IS 'Atomically decrements team treasury by specified amount. Returns new treasury value. Raises exception if result would be negative.';
