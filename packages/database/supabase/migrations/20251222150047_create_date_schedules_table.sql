-- Create date_schedules table for managing when games can be played
-- Similar to venue availability but for defining available game dates/times

CREATE TABLE date_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL, -- e.g., "Regular Season", "Tuesday Night Games", "Weekend Tournaments"

    -- Availability configuration (same as venues)
    use_specific_dates BOOLEAN DEFAULT false,
    availability_start_datetime TIMESTAMP,
    availability_end_datetime TIMESTAMP,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_type VARCHAR(20), -- 'daily', 'on_certain_days', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'custom'
    recurrence_days JSONB, -- Array of day names for 'on_certain_days'
    recurrence_interval INTEGER, -- For 'custom' - every X units
    recurrence_period VARCHAR(20), -- For 'custom' - 'days', 'weeks', 'months'
    specific_dates JSONB, -- Array of date strings for specific dates mode

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_date_schedules_league_season ON date_schedules(league_id, season_number);

-- Comments
COMMENT ON TABLE date_schedules IS 'Defines when games can be scheduled - reusable date/time patterns';
COMMENT ON COLUMN date_schedules.name IS 'User-friendly name for the schedule (e.g., "Tuesday Night Games")';
COMMENT ON COLUMN date_schedules.use_specific_dates IS 'If true, use specific_dates array. If false, use recurring availability.';
COMMENT ON COLUMN date_schedules.recurrence_type IS 'Type of recurrence: daily, on_certain_days, weekly, biweekly, semimonthly, monthly, custom';
