-- Add fields to players table for advancement tracking

ALTER TABLE players
ADD COLUMN IF NOT EXISTS spp_spent integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS player_level text DEFAULT 'Rookie',
ADD COLUMN IF NOT EXISTS advancements_count integer DEFAULT 0; -- Track how many times they've advanced

COMMENT ON COLUMN players.spp_spent IS 'SPP spent on advancements (for tracking unspent SPP)';
COMMENT ON COLUMN players.player_level IS 'Player level (Rookie, Experienced, Veteran, etc.)';
COMMENT ON COLUMN players.advancements_count IS 'Number of times player has taken an advancement';

-- Add fields for tracking throw team-mate actions
ALTER TABLE players
ADD COLUMN IF NOT EXISTS superb_throws integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_landings integer DEFAULT 0;

COMMENT ON COLUMN players.superb_throws IS 'Number of successful Throw Team-mate actions (Superb Throws)';
COMMENT ON COLUMN players.successful_landings IS 'Number of successful landings from being thrown';
