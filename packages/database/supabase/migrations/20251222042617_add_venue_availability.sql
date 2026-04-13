-- Add availability fields to venues table
-- Venues can have:
-- 1. Single time range (one-time availability)
-- 2. Recurring schedule (weekly pattern)
-- 3. Specific date/time slots (multiple specific times)

ALTER TABLE venues
ADD COLUMN availability_type VARCHAR(20) DEFAULT 'single', -- 'single', 'recurring', 'specific'
ADD COLUMN availability_data JSONB; -- Flexible structure based on type

COMMENT ON COLUMN venues.availability_type IS 'Type of availability: single (one-time range), recurring (weekly pattern), specific (list of date/times)';
COMMENT ON COLUMN venues.availability_data IS 'Availability schedule data - structure depends on availability_type';

-- Example structures for availability_data:
--
-- Single (one-time range):
-- {
--   "start": "2025-01-15T18:00:00Z",
--   "end": "2025-06-30T22:00:00Z"
-- }
--
-- Recurring (weekly pattern):
-- {
--   "schedule": [
--     {"day": "Monday", "start_time": "18:00", "end_time": "22:00"},
--     {"day": "Wednesday", "start_time": "18:00", "end_time": "22:00"}
--   ]
-- }
--
-- Specific (list of date/time slots):
-- {
--   "slots": [
--     {"start": "2025-01-15T18:00:00Z", "end": "2025-01-15T22:00:00Z"},
--     {"start": "2025-01-22T18:00:00Z", "end": "2025-01-22T22:00:00Z"}
--   ]
-- }
