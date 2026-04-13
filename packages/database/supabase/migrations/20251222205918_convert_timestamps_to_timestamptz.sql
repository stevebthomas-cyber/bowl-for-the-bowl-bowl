-- Convert all timestamp columns to timestamptz for proper timezone handling
-- This ensures all times are stored in UTC and properly converted by clients

-- Date schedules
ALTER TABLE date_schedules
  ALTER COLUMN availability_start_datetime TYPE timestamptz USING availability_start_datetime AT TIME ZONE 'UTC',
  ALTER COLUMN availability_end_datetime TYPE timestamptz USING availability_end_datetime AT TIME ZONE 'UTC';

-- Venues
ALTER TABLE venues
  ALTER COLUMN availability_start_datetime TYPE timestamptz USING availability_start_datetime AT TIME ZONE 'UTC',
  ALTER COLUMN availability_end_datetime TYPE timestamptz USING availability_end_datetime AT TIME ZONE 'UTC';

-- Matches
ALTER TABLE matches
  ALTER COLUMN scheduled_date TYPE timestamptz USING scheduled_date AT TIME ZONE 'UTC';

-- Note: The USING clause treats existing values as if they were in UTC
-- If your existing data is already in a different timezone, you may need to adjust this migration
