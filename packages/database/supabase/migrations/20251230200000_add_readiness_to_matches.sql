-- Add readiness, roster lock, and bounty fields to matches table

-- Add location field if not exists
ALTER TABLE matches ADD COLUMN IF NOT EXISTS location text;

-- Add readiness flags
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_ready boolean DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_ready boolean DEFAULT false;

-- Add roster lock flags
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_roster_locked boolean DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_roster_locked boolean DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_roster_locked_at timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_roster_locked_at timestamptz;

-- Add roster lock deadline (calculated from scheduled_date)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS roster_lock_deadline timestamptz;

-- Add bounty/bonus system fields
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bounty_status text CHECK (bounty_status IN ('active', 'claimed', 'bonus'));
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bounty_claimed_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS bounty_claimed_at timestamptz;

-- Add completed flag if not exists
ALTER TABLE matches ADD COLUMN IF NOT EXISTS completed boolean DEFAULT false;

-- Add score fields if not exists
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_score integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_score integer;

-- Add result field if not exists
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result text CHECK (result IN ('home_win', 'away_win', 'draw'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_matches_scheduled_date ON matches(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_matches_bounty_status ON matches(bounty_status);
CREATE INDEX IF NOT EXISTS idx_matches_roster_locks ON matches(home_roster_locked, away_roster_locked);
CREATE INDEX IF NOT EXISTS idx_matches_completed ON matches(completed);

COMMENT ON COLUMN matches.location IS 'Match venue/location';
COMMENT ON COLUMN matches.home_ready IS 'Home coach marked as ready';
COMMENT ON COLUMN matches.away_ready IS 'Away coach marked as ready';
COMMENT ON COLUMN matches.home_roster_locked IS 'Home roster submitted and locked';
COMMENT ON COLUMN matches.away_roster_locked IS 'Away roster submitted and locked';
COMMENT ON COLUMN matches.roster_lock_deadline IS 'Deadline for roster submission (X hours before scheduled_date)';
COMMENT ON COLUMN matches.bounty_status IS 'Match bounty status: active (available), claimed (taken), bonus (make-up match)';
COMMENT ON COLUMN matches.bounty_claimed_by IS 'User who claimed the bounty match';
