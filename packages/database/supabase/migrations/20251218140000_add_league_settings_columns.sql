-- Add league settings as top-level columns for easier querying
-- These were previously only in rules_config JSONB

ALTER TABLE leagues
ADD COLUMN IF NOT EXISTS max_teams INTEGER,
ADD COLUMN IF NOT EXISTS min_teams INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS divisions INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS games_per_season INTEGER,
ADD COLUMN IF NOT EXISTS win_points INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS tie_points INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS loss_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS attendance_threshold INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS playoff_format VARCHAR(50),
ADD COLUMN IF NOT EXISTS playoff_seeding VARCHAR(20) DEFAULT 'by_points',
ADD COLUMN IF NOT EXISTS home_advantage BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS starting_treasury INTEGER DEFAULT 1000000;

-- Add constraints
ALTER TABLE leagues
ADD CONSTRAINT leagues_max_teams_check CHECK (max_teams IS NULL OR max_teams >= min_teams),
ADD CONSTRAINT leagues_divisions_check CHECK (divisions IS NULL OR divisions > 0),
ADD CONSTRAINT leagues_games_per_season_check CHECK (games_per_season IS NULL OR games_per_season > 0);

-- Comments
COMMENT ON COLUMN leagues.max_teams IS 'Maximum number of teams allowed in league';
COMMENT ON COLUMN leagues.min_teams IS 'Minimum teams required to start season';
COMMENT ON COLUMN leagues.divisions IS 'Number of divisions (1 for single division)';
COMMENT ON COLUMN leagues.games_per_season IS 'Number of regular season games per team';
COMMENT ON COLUMN leagues.win_points IS 'League points awarded for a win';
COMMENT ON COLUMN leagues.tie_points IS 'League points awarded for a tie';
COMMENT ON COLUMN leagues.loss_points IS 'League points awarded for a loss';
COMMENT ON COLUMN leagues.attendance_threshold IS 'Min dedicated fans needed for attendance roll';
COMMENT ON COLUMN leagues.playoff_format IS 'Type of playoff format (none, championship, top_4, play_in, top_8, division_winners)';
COMMENT ON COLUMN leagues.playoff_seeding IS 'How teams are seeded (by_points, by_division)';
COMMENT ON COLUMN leagues.home_advantage IS 'Whether higher seed gets home field advantage in playoffs';
COMMENT ON COLUMN leagues.starting_treasury IS 'Starting treasury for new teams (default 1,000,000 gold)';
