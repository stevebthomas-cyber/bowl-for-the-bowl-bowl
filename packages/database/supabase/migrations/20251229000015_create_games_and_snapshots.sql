-- Create tables for games and snapshots

-- Games table to track matches
CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid REFERENCES leagues(id) ON DELETE CASCADE,
  home_team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  away_team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  game_type text NOT NULL CHECK (game_type IN ('friendly', 'fixture')),
  scheduled_date timestamptz,
  completed boolean DEFAULT false,
  home_score integer,
  away_score integer,
  result text CHECK (result IN ('home_win', 'away_win', 'draw')),
  home_stalling boolean DEFAULT false, -- Manually recorded by coaches
  away_stalling boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_games_league ON games(league_id);
CREATE INDEX idx_games_home_team ON games(home_team_id);
CREATE INDEX idx_games_away_team ON games(away_team_id);
CREATE INDEX idx_games_type ON games(game_type);

-- Game snapshots for friendly games (to revert after)
CREATE TABLE IF NOT EXISTS game_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  snapshot_data jsonb NOT NULL, -- Full team + players state
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_game_snapshots_game ON game_snapshots(game_id);
CREATE INDEX idx_game_snapshots_team ON game_snapshots(team_id);

-- Game events (touchdowns, casualties, etc.)
CREATE TABLE IF NOT EXISTS game_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL, -- 'touchdown', 'casualty', 'completion', 'interception', 'superb_throw', 'successful_landing', 'mvp'
  spp_awarded integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_game_events_game ON game_events(game_id);
CREATE INDEX idx_game_events_player ON game_events(player_id);
CREATE INDEX idx_game_events_type ON game_events(event_type);

COMMENT ON TABLE games IS 'Blood Bowl games (fixtures and friendlies)';
COMMENT ON TABLE game_snapshots IS 'Team/player state snapshots for friendly games (to revert after)';
COMMENT ON TABLE game_events IS 'Individual game events (TDs, casualties, completions, etc.)';
