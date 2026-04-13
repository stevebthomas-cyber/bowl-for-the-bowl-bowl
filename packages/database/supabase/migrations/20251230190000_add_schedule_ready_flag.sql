-- Add schedule_ready flag to leagues table

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS schedule_ready boolean DEFAULT false;

COMMENT ON COLUMN leagues.schedule_ready IS 'Schedule has been reviewed and is ready for season activation';
