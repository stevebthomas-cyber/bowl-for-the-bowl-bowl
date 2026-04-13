-- Add passing column to players table for PA (Passing Agility) stat
-- Some positions (like Deathroller, Chainsaw, Woodland Fox) don't have PA, so it's nullable

ALTER TABLE players
ADD COLUMN IF NOT EXISTS passing integer;

COMMENT ON COLUMN players.passing IS 'Passing Agility (PA) stat - null for positions that cannot pass';
