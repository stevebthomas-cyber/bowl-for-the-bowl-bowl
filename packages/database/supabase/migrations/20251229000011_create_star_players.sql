-- Create star_players table

CREATE TABLE IF NOT EXISTS star_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cost integer NOT NULL,
  ma integer NOT NULL,
  st integer NOT NULL,
  ag integer NOT NULL,
  pa integer,
  av integer NOT NULL,
  skills text[] NOT NULL DEFAULT '{}',
  special_rules text[] DEFAULT '{}',
  plays_for text NOT NULL, -- Raw text like "Chaos Clash", "Old World Classic", "Any", "Any Team but Sylvanian Spotlight"
  excluded_leagues text[] DEFAULT '{}', -- Parsed exclusions like ["Sylvanian Spotlight"]
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_star_players_plays_for ON star_players(plays_for);

COMMENT ON TABLE star_players IS 'Star Players that can be hired as inducements';
COMMENT ON COLUMN star_players.plays_for IS 'Raw text describing which leagues this star player is available for';
COMMENT ON COLUMN star_players.excluded_leagues IS 'Array of league names this star player cannot play for';
