-- Create venues and pitches tables for match scheduling
-- Venues represent physical locations, pitches are specific playing fields at a venue

-- Venues Table
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    include_in_season BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venues_league ON venues(league_id);

-- Pitches Table
CREATE TABLE pitches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    include_in_season BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pitches_venue ON pitches(venue_id);

-- Comments
COMMENT ON TABLE venues IS 'Physical locations where matches can be played';
COMMENT ON TABLE pitches IS 'Specific playing fields at a venue';
COMMENT ON COLUMN venues.include_in_season IS 'Whether this venue should be considered when scheduling matches';
COMMENT ON COLUMN pitches.include_in_season IS 'Whether this pitch should be considered when scheduling matches';
