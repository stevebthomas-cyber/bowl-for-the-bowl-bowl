-- Add week_number column to matches table to track which period/week a match belongs to
ALTER TABLE matches ADD COLUMN week_number INTEGER;

-- Add a comment explaining the column's purpose
COMMENT ON COLUMN matches.week_number IS 'Indicates which period/week number this match is scheduled for in the season';

-- Add an index for efficient querying by week_number
CREATE INDEX idx_matches_week_number ON matches(league_id, season_number, week_number);
