-- Create season_archives table for storing historical season data as JSON blobs

CREATE TABLE season_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Team snapshot at end of season
  team_data JSONB NOT NULL,

  -- All players on roster at end of season
  roster_data JSONB NOT NULL,

  -- All matches played this season
  matches_data JSONB NOT NULL,

  -- Season statistics summary
  stats_summary JSONB NOT NULL,

  -- League settings at time of archival
  league_settings JSONB NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_season_archives_league_id ON season_archives(league_id);
CREATE INDEX idx_season_archives_team_id ON season_archives(team_id);
CREATE INDEX idx_season_archives_season_number ON season_archives(season_number);
CREATE INDEX idx_season_archives_league_season ON season_archives(league_id, season_number);
CREATE INDEX idx_season_archives_team_season ON season_archives(team_id, season_number);

-- Unique constraint: one archive per team per season
CREATE UNIQUE INDEX idx_season_archives_unique ON season_archives(team_id, season_number);

-- Comments
COMMENT ON TABLE season_archives IS 'Archived season data stored as JSON blobs per team for efficient historical queries';
COMMENT ON COLUMN season_archives.team_data IS 'Team snapshot including name, treasury, value, W/L/T, etc.';
COMMENT ON COLUMN season_archives.roster_data IS 'Complete roster with all player stats, skills, injuries at season end';
COMMENT ON COLUMN season_archives.matches_data IS 'All matches played this season with scores and casualty counts';
COMMENT ON COLUMN season_archives.stats_summary IS 'Aggregated stats: total TD, CAS, MVP, SPP earned, etc.';
COMMENT ON COLUMN season_archives.league_settings IS 'League configuration at time of archival for historical context';

-- Add trigger to update updated_at
CREATE TRIGGER set_season_archives_updated_at
  BEFORE UPDATE ON season_archives
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
