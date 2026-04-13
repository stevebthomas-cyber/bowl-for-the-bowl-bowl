-- Add soft delete capability to teams
-- Teams can be marked as deleted but kept for historical records
-- At end of season, they can be archived permanently

-- First, revert the CASCADE changes from the previous migration
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_home_team_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_away_team_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_conceded_by_team_id_fkey;
ALTER TABLE match_participants DROP CONSTRAINT IF EXISTS match_participants_team_id_fkey;
ALTER TABLE bounties DROP CONSTRAINT IF EXISTS bounties_team_id_fkey;
ALTER TABLE guest_coach_sessions DROP CONSTRAINT IF EXISTS guest_coach_sessions_team_id_fkey;
ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_team_id_fkey;

-- Re-add constraints without CASCADE (default is RESTRICT)
ALTER TABLE matches
  ADD CONSTRAINT matches_home_team_id_fkey
  FOREIGN KEY (home_team_id)
  REFERENCES teams(id);

ALTER TABLE matches
  ADD CONSTRAINT matches_away_team_id_fkey
  FOREIGN KEY (away_team_id)
  REFERENCES teams(id);

ALTER TABLE matches
  ADD CONSTRAINT matches_conceded_by_team_id_fkey
  FOREIGN KEY (conceded_by_team_id)
  REFERENCES teams(id);

ALTER TABLE match_participants
  ADD CONSTRAINT match_participants_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES teams(id);

ALTER TABLE bounties
  ADD CONSTRAINT bounties_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES teams(id);

ALTER TABLE guest_coach_sessions
  ADD CONSTRAINT guest_coach_sessions_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES teams(id);

ALTER TABLE match_events
  ADD CONSTRAINT match_events_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES teams(id);

-- Add deleted_at column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add index for filtering active teams
CREATE INDEX IF NOT EXISTS teams_deleted_at_idx ON teams(deleted_at) WHERE deleted_at IS NULL;

-- Add comment explaining the soft delete pattern
COMMENT ON COLUMN teams.deleted_at IS 'Timestamp when team was soft-deleted. NULL means team is active. Deleted teams are hidden from normal views but preserved for historical data.';
