-- Add venue and pitch foreign keys to matches table
-- This allows assigning specific venues/pitches to matches for scheduling

-- Add venue_id column (nullable - matches may not have venue assigned yet)
ALTER TABLE matches ADD COLUMN venue_id UUID REFERENCES venues(id);

-- Add pitch_id column (nullable - matches may not have pitch assigned yet)
ALTER TABLE matches ADD COLUMN pitch_id UUID REFERENCES pitches(id);

-- Add index for venue lookups
CREATE INDEX idx_matches_venue ON matches(venue_id);

-- Add index for pitch lookups
CREATE INDEX idx_matches_pitch ON matches(pitch_id);

-- Add comment explaining the venue/pitch assignment
COMMENT ON COLUMN matches.venue_id IS 'The venue where this match is scheduled to be played';
COMMENT ON COLUMN matches.pitch_id IS 'The specific pitch at the venue where this match will be played';
