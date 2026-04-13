-- Create seasons table to properly separate league infrastructure from season-specific data
-- Leagues = organization/infrastructure (persists)
-- Seasons = schedule, stats, games for a specific time period

CREATE TABLE seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    season_name VARCHAR(255), -- Null = auto-generate "Season N"

    -- Date range
    start_date TIMESTAMP,
    end_date TIMESTAMP,

    -- Team/Division settings
    min_teams INTEGER,
    max_teams INTEGER,
    number_of_divisions INTEGER DEFAULT 1,

    -- Schedule settings
    games_per_team INTEGER,
    number_of_rounds INTEGER,
    game_duration_minutes INTEGER DEFAULT 75, -- Minimum game duration

    -- Schedule type (additive - can select multiple)
    single_round_robin BOOLEAN DEFAULT false,
    double_round_robin BOOLEAN DEFAULT false,
    single_split_round_robin BOOLEAN DEFAULT false,
    double_split_round_robin BOOLEAN DEFAULT false,

    -- Scheduling preferences
    schedule_preference VARCHAR(20), -- 'compact' or 'relaxed'
    game_frequency VARCHAR(20), -- 'daily', 'weekly', 'biweekly', 'monthly', 'bimonthly'
    preferred_days JSONB, -- Array of day names: ["Monday", "Wednesday", "Friday"]

    -- Status
    is_draft BOOLEAN DEFAULT true, -- Draft = not shared with players
    status VARCHAR(20) DEFAULT 'setup', -- 'setup', 'active', 'playoffs', 'completed'

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(league_id, season_number)
);

-- Indexes
CREATE INDEX idx_seasons_league ON seasons(league_id);
CREATE INDEX idx_seasons_status ON seasons(status);
CREATE INDEX idx_seasons_is_draft ON seasons(is_draft);

-- Comments
COMMENT ON TABLE seasons IS 'Season-specific data including schedule settings, separated from league infrastructure';
COMMENT ON COLUMN seasons.season_name IS 'Custom season name, or null for auto-generated "Season N"';
COMMENT ON COLUMN seasons.is_draft IS 'Draft schedules are not shared with players and do not trigger notifications';
COMMENT ON COLUMN seasons.schedule_preference IS 'compact = fewer rounds, relaxed = spread to end date';
COMMENT ON COLUMN seasons.single_round_robin IS 'All teams play all teams once';
COMMENT ON COLUMN seasons.double_round_robin IS 'All teams play home and away against all teams';
COMMENT ON COLUMN seasons.single_split_round_robin IS 'All teams play all teams in their division once';
COMMENT ON COLUMN seasons.double_split_round_robin IS 'All teams play home and away against division teams';

-- Auto-update timestamp trigger
CREATE TRIGGER set_seasons_updated_at
    BEFORE UPDATE ON seasons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
