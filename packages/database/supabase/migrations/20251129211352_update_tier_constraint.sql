-- Update tier constraint to support Season 3 tiers (1-4)

ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_tier_check;
ALTER TABLE teams ADD CONSTRAINT teams_tier_check CHECK (tier BETWEEN 1 AND 4);
