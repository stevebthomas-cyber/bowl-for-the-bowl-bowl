-- Simplify venue availability to match the new flow
-- Two modes: recurring (with recurrence options) or specific dates

-- Drop old columns
ALTER TABLE venues DROP COLUMN IF EXISTS availability_type;
ALTER TABLE venues DROP COLUMN IF EXISTS availability_data;

-- Add new columns for simplified availability
ALTER TABLE venues
ADD COLUMN use_specific_dates BOOLEAN DEFAULT false,
ADD COLUMN availability_start_datetime TIMESTAMP,
ADD COLUMN availability_end_datetime TIMESTAMP,
ADD COLUMN is_recurring BOOLEAN DEFAULT false,
ADD COLUMN recurrence_type VARCHAR(20), -- 'daily', 'on_certain_days', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'custom'
ADD COLUMN recurrence_days JSONB, -- Array of day names for 'on_certain_days'
ADD COLUMN recurrence_interval INTEGER, -- For 'custom' - every X units
ADD COLUMN recurrence_period VARCHAR(20), -- For 'custom' - 'days', 'weeks', 'months'
ADD COLUMN specific_dates JSONB; -- Array of date strings for specific dates mode

COMMENT ON COLUMN venues.use_specific_dates IS 'If true, use specific_dates array. If false, use recurring availability.';
COMMENT ON COLUMN venues.availability_start_datetime IS 'Start date/time for recurring mode';
COMMENT ON COLUMN venues.availability_end_datetime IS 'End date/time for recurring mode';
COMMENT ON COLUMN venues.is_recurring IS 'If true, apply recurrence pattern between start and end dates';
COMMENT ON COLUMN venues.recurrence_type IS 'Type of recurrence: daily, on_certain_days, weekly, biweekly, semimonthly, monthly, custom';
COMMENT ON COLUMN venues.recurrence_days IS 'Array of day names (e.g., ["Monday", "Wednesday"]) for on_certain_days type';
COMMENT ON COLUMN venues.recurrence_interval IS 'For custom recurrence: every X [period]';
COMMENT ON COLUMN venues.recurrence_period IS 'For custom recurrence: days, weeks, or months';
COMMENT ON COLUMN venues.specific_dates IS 'Array of specific ISO date strings for specific dates mode';
