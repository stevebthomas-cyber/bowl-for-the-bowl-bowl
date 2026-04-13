-- Add CASCADE delete to matches table foreign keys for teams
-- This allows teams to be deleted even if they have associated matches

-- Drop existing constraints
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_home_team_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_away_team_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_conceded_by_team_id_fkey;

-- Re-add constraints with ON DELETE CASCADE
ALTER TABLE matches
  ADD CONSTRAINT matches_home_team_id_fkey
  FOREIGN KEY (home_team_id)
  REFERENCES teams(id)
  ON DELETE CASCADE;

ALTER TABLE matches
  ADD CONSTRAINT matches_away_team_id_fkey
  FOREIGN KEY (away_team_id)
  REFERENCES teams(id)
  ON DELETE CASCADE;

ALTER TABLE matches
  ADD CONSTRAINT matches_conceded_by_team_id_fkey
  FOREIGN KEY (conceded_by_team_id)
  REFERENCES teams(id)
  ON DELETE CASCADE;

-- Also check match_participants and bounties - they're missing CASCADE too
ALTER TABLE match_participants DROP CONSTRAINT IF EXISTS match_participants_team_id_fkey;
ALTER TABLE match_participants
  ADD CONSTRAINT match_participants_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES teams(id)
  ON DELETE CASCADE;

ALTER TABLE bounties DROP CONSTRAINT IF EXISTS bounties_team_id_fkey;
ALTER TABLE bounties
  ADD CONSTRAINT bounties_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES teams(id)
  ON DELETE CASCADE;

ALTER TABLE guest_coach_sessions DROP CONSTRAINT IF EXISTS guest_coach_sessions_team_id_fkey;
ALTER TABLE guest_coach_sessions
  ADD CONSTRAINT guest_coach_sessions_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES teams(id)
  ON DELETE CASCADE;

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_team_id_fkey;
ALTER TABLE match_events
  ADD CONSTRAINT match_events_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES teams(id)
  ON DELETE CASCADE;
