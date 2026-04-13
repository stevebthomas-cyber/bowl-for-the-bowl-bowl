-- Add readiness, roster lock, and bounty fields to games table

-- Add location field
ALTER TABLE games ADD COLUMN IF NOT EXISTS location text;

-- Add readiness flags
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_ready boolean DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_ready boolean DEFAULT false;

-- Add roster lock flags
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_roster_locked boolean DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_roster_locked boolean DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_roster_locked_at timestamptz;
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_roster_locked_at timestamptz;

-- Add roster lock deadline (calculated from scheduled_date)
ALTER TABLE games ADD COLUMN IF NOT EXISTS roster_lock_deadline timestamptz;

-- Add bounty/bonus system fields
ALTER TABLE games ADD COLUMN IF NOT EXISTS bounty_status text CHECK (bounty_status IN ('active', 'claimed', 'bonus'));
ALTER TABLE games ADD COLUMN IF NOT EXISTS bounty_claimed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS bounty_claimed_at timestamptz;

-- Add week number for league scheduling
ALTER TABLE games ADD COLUMN IF NOT EXISTS week_number integer;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_scheduled_date ON games(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_games_bounty_status ON games(bounty_status);
CREATE INDEX IF NOT EXISTS idx_games_roster_locks ON games(home_roster_locked, away_roster_locked);

COMMENT ON COLUMN games.location IS 'Match venue/location';
COMMENT ON COLUMN games.home_ready IS 'Home coach marked as ready';
COMMENT ON COLUMN games.away_ready IS 'Away coach marked as ready';
COMMENT ON COLUMN games.home_roster_locked IS 'Home roster submitted and locked';
COMMENT ON COLUMN games.away_roster_locked IS 'Away roster submitted and locked';
COMMENT ON COLUMN games.roster_lock_deadline IS 'Deadline for roster submission (X hours before scheduled_date)';
COMMENT ON COLUMN games.bounty_status IS 'Match bounty status: active (available), claimed (taken), bonus (make-up match)';
COMMENT ON COLUMN games.bounty_claimed_by IS 'User who claimed the bounty match';
