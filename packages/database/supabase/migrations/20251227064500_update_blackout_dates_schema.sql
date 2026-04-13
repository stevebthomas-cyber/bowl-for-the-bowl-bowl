-- Update blackout_dates table to use DATE instead of TIMESTAMPTZ and add pitch support

-- Drop existing table if it exists (since we just created it and have no data)
DROP TABLE IF EXISTS blackout_dates;

-- Recreate with proper schema
CREATE TABLE blackout_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL, -- e.g., "Christmas Break", "Venue Maintenance", "Holiday Weekend"

    -- Scope: league-wide, venue-specific, or pitch-specific
    applies_to VARCHAR(20) NOT NULL DEFAULT 'league', -- 'league', 'venues', or 'pitches'
    venue_ids JSONB, -- Array of venue UUIDs if applies_to = 'venues' or 'pitches'
    pitch_ids JSONB, -- Array of pitch UUIDs if applies_to = 'pitches'

    -- Date configuration (DATE only, no time component)
    blackout_type VARCHAR(20) NOT NULL, -- 'single_date', 'date_range', 'recurring', 'holiday', 'holiday_weekend'

    -- For single_date and date_range (DATE only)
    start_date DATE,
    end_date DATE, -- NULL for single_date, actual end for date_range

    -- For recurring blackouts (e.g., "First Monday of every month")
    is_recurring BOOLEAN DEFAULT false,
    recurrence_type VARCHAR(20), -- 'daily', 'weekly', 'biweekly', 'monthly', 'on_certain_days', 'custom'
    recurrence_days JSONB, -- Array of day names for 'on_certain_days'
    recurrence_interval INTEGER, -- For 'custom' - every X units
    recurrence_period VARCHAR(20), -- For 'custom' - 'days', 'weeks', 'months'

    -- For holiday-based blackouts
    holiday_type VARCHAR(50), -- 'christmas', 'new_years', 'thanksgiving', etc.
    include_weekend BOOLEAN DEFAULT false, -- For 'holiday_weekend' type

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blackout_dates_league_season ON blackout_dates(league_id, season_number);
CREATE INDEX idx_blackout_dates_type ON blackout_dates(blackout_type);
CREATE INDEX idx_blackout_dates_date_range ON blackout_dates(start_date, end_date);

-- Comments
COMMENT ON TABLE blackout_dates IS 'Defines when games cannot be scheduled - overrides date schedules and venue availability';
COMMENT ON COLUMN blackout_dates.name IS 'User-friendly name for the blackout (e.g., "Christmas Break")';
COMMENT ON COLUMN blackout_dates.applies_to IS 'Scope: league-wide, venue-specific, or pitch-specific';
COMMENT ON COLUMN blackout_dates.venue_ids IS 'Array of venue UUIDs if applies_to = venues or pitches';
COMMENT ON COLUMN blackout_dates.pitch_ids IS 'Array of pitch UUIDs if applies_to = pitches';
COMMENT ON COLUMN blackout_dates.blackout_type IS 'Type: single_date, date_range, recurring, holiday, holiday_weekend';
COMMENT ON COLUMN blackout_dates.start_date IS 'Start date (DATE only, no time)';
COMMENT ON COLUMN blackout_dates.end_date IS 'End date for ranges (DATE only, no time)';
COMMENT ON COLUMN blackout_dates.holiday_type IS 'Holiday identifier for API lookup (e.g., christmas, thanksgiving)';
COMMENT ON COLUMN blackout_dates.include_weekend IS 'For holiday_weekend type, includes Fri-Mon around the holiday';
