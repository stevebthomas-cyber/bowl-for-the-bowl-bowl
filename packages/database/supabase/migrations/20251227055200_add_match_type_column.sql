-- Add match_type column to matches table
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'regular';

-- Add a check constraint to ensure valid match types
ALTER TABLE matches
ADD CONSTRAINT check_match_type CHECK (match_type IN ('regular', 'friendly', 'playoff'));

-- Add a comment to document the column
COMMENT ON COLUMN matches.match_type IS 'Type of match: regular (fixture counted on record), friendly (not counted), or playoff';
