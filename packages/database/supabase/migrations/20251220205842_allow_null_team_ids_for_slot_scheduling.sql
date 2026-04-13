-- Allow null team IDs to support slot-based scheduling
-- This enables creating match templates with abstract slots that can be filled later

-- Make home_team_id nullable
ALTER TABLE matches ALTER COLUMN home_team_id DROP NOT NULL;

-- Make away_team_id nullable
ALTER TABLE matches ALTER COLUMN away_team_id DROP NOT NULL;

-- Make scheduled_date nullable (matches may not have dates assigned yet)
ALTER TABLE matches ALTER COLUMN scheduled_date DROP NOT NULL;

-- Add check constraint to ensure either both team IDs are set or metadata contains slot info
ALTER TABLE matches ADD CONSTRAINT matches_team_or_slot_check
  CHECK (
    (home_team_id IS NOT NULL AND away_team_id IS NOT NULL)
    OR
    (metadata IS NOT NULL AND metadata ? 'homeSlot' AND metadata ? 'awaySlot')
  );

-- Add comment explaining the slot-based scheduling system
COMMENT ON CONSTRAINT matches_team_or_slot_check ON matches IS
  'Ensures matches either have both teams assigned OR have slot identifiers in metadata for later assignment';
