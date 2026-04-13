-- BBLMS Initial Schema Migration
-- Creates all tables, enums, and relationships for Blood Bowl League Management System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE season_status AS ENUM ('setup', 'active', 'playoffs', 'closed');
CREATE TYPE match_status AS ENUM ('scheduled', 'bounty_posted', 'in_progress', 'completed', 'conceded', 'cancelled');
CREATE TYPE player_status AS ENUM ('active', 'injured', 'suspended', 'dead', 'retired');
CREATE TYPE user_role_type AS ENUM ('commissioner', 'asst_commissioner', 'coach');
CREATE TYPE team_ownership_role AS ENUM ('owner', 'assistant_coach');
CREATE TYPE match_participant_role AS ENUM ('coach', 'guest_coach');
CREATE TYPE match_event_type AS ENUM ('touchdown', 'completion', 'interception', 'casualty', 'mvp');
CREATE TYPE sob_timeframe AS ENUM ('season', 'game', 'half', 'your_play', 'opponent_play');
CREATE TYPE sob_status AS ENUM ('proposed', 'under_review', 'approved', 'rejected');
CREATE TYPE sob_review_decision AS ENUM ('approve', 'amend', 'arbitrate');
CREATE TYPE bounty_type AS ENUM ('no_show', 'civil_war', 'bonus');
CREATE TYPE bounty_status AS ENUM ('active', 'claimed', 'expired', 'cancelled');
CREATE TYPE guest_coach_status AS ENUM ('posted', 'claimed', 'completed', 'expired');
CREATE TYPE match_side AS ENUM ('home', 'away');
CREATE TYPE award_recipient_type AS ENUM ('player', 'coach', 'team');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_id VARCHAR(255) UNIQUE NOT NULL,
    discord_username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active TIMESTAMP
);

CREATE INDEX idx_users_discord_id ON users(discord_id);

-- Leagues Table
CREATE TABLE leagues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    commissioner_id UUID NOT NULL REFERENCES users(id),
    asst_commissioner_id UUID REFERENCES users(id),
    season_number INTEGER NOT NULL DEFAULT 1,
    season_status season_status NOT NULL DEFAULT 'setup',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    current_season_start TIMESTAMP,
    current_season_end TIMESTAMP,
    rules_config JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_leagues_commissioner ON leagues(commissioner_id);

-- User Roles Table
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role_type NOT NULL,
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    UNIQUE(league_id, user_id, role)
);

CREATE INDEX idx_user_roles_league ON user_roles(league_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);

-- ============================================================================
-- TEAM TABLES
-- ============================================================================

-- Teams Table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    race VARCHAR(100) NOT NULL,
    tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
    division INTEGER,

    -- Financial
    treasury INTEGER NOT NULL DEFAULT 0,
    team_value INTEGER NOT NULL DEFAULT 0,

    -- Fans & Rerolls
    dedicated_fans INTEGER NOT NULL DEFAULT 0,
    min_dedicated_fans INTEGER NOT NULL DEFAULT 1,
    rerolls INTEGER NOT NULL DEFAULT 0,

    -- Season Tracking
    season_created INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,

    -- Record
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    ties INTEGER NOT NULL DEFAULT 0,
    league_points INTEGER NOT NULL DEFAULT 0,

    -- SOB Tracking
    total_sobs INTEGER NOT NULL DEFAULT 0,

    -- Meta
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(league_id, name)
);

CREATE INDEX idx_teams_league ON teams(league_id);
CREATE INDEX idx_teams_active ON teams(active);

-- Team Ownership Table
CREATE TABLE team_ownership (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_ownership_role NOT NULL,
    can_modify_roster BOOLEAN NOT NULL DEFAULT true,
    can_submit_reports BOOLEAN NOT NULL DEFAULT true,
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES users(id),
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_ownership_team ON team_ownership(team_id);
CREATE INDEX idx_team_ownership_user ON team_ownership(user_id);

-- Players Table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(100) NOT NULL,
    number INTEGER,

    -- Stats
    movement INTEGER NOT NULL,
    strength INTEGER NOT NULL,
    agility INTEGER NOT NULL,
    armor_value INTEGER NOT NULL,

    -- Skills
    skills TEXT[] NOT NULL DEFAULT '{}',

    -- Career Stats
    spp INTEGER NOT NULL DEFAULT 0,
    touchdowns INTEGER NOT NULL DEFAULT 0,
    completions INTEGER NOT NULL DEFAULT 0,
    interceptions INTEGER NOT NULL DEFAULT 0,
    casualties INTEGER NOT NULL DEFAULT 0,
    mvp_awards INTEGER NOT NULL DEFAULT 0,

    -- Status
    status player_status NOT NULL DEFAULT 'active',
    injury_details TEXT,
    miss_next_game BOOLEAN NOT NULL DEFAULT false,

    -- Value
    player_value INTEGER NOT NULL,

    -- Meta
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    season_joined INTEGER NOT NULL,

    UNIQUE(team_id, number)
);

CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_players_status ON players(status);

-- ============================================================================
-- MATCH TABLES
-- ============================================================================

-- Matches Table
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,

    -- Teams
    home_team_id UUID NOT NULL REFERENCES teams(id),
    away_team_id UUID NOT NULL REFERENCES teams(id),

    -- Scheduling
    scheduled_date TIMESTAMP NOT NULL,
    location VARCHAR(255),

    -- Status
    status match_status NOT NULL DEFAULT 'scheduled',

    -- Results
    home_score INTEGER,
    away_score INTEGER,
    completed_at TIMESTAMP,

    -- Special Cases
    is_civil_war BOOLEAN NOT NULL DEFAULT false,
    conceded_by_team_id UUID REFERENCES teams(id),
    under_review BOOLEAN NOT NULL DEFAULT false,

    -- Meta
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(league_id, season_number, match_number),
    CHECK (home_team_id != away_team_id)
);

CREATE INDEX idx_matches_league ON matches(league_id);
CREATE INDEX idx_matches_season ON matches(season_number);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_teams ON matches(home_team_id, away_team_id);

-- Match Participants Table
CREATE TABLE match_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role match_participant_role NOT NULL,
    side match_side NOT NULL,

    -- Attendance tracking
    confirmed_attendance BOOLEAN NOT NULL DEFAULT false,
    confirmed_at TIMESTAMP,
    no_show BOOLEAN NOT NULL DEFAULT false,

    UNIQUE(match_id, team_id)
);

CREATE INDEX idx_match_participants_match ON match_participants(match_id);
CREATE INDEX idx_match_participants_user ON match_participants(user_id);

-- Guest Coach Sessions Table
CREATE TABLE guest_coach_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id),
    guest_user_id UUID REFERENCES users(id),

    -- Bounty Details
    bounty_amount INTEGER NOT NULL,
    bonus_amount INTEGER NOT NULL,
    win_bonus_paid BOOLEAN NOT NULL DEFAULT false,

    -- Status
    status guest_coach_status NOT NULL DEFAULT 'posted',
    posted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,

    -- Access control
    can_view_sobs BOOLEAN NOT NULL DEFAULT false,

    UNIQUE(match_id, team_id)
);

CREATE INDEX idx_guest_coach_sessions_match ON guest_coach_sessions(match_id);
CREATE INDEX idx_guest_coach_sessions_guest ON guest_coach_sessions(guest_user_id);

-- Match Reports Table
CREATE TABLE match_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID UNIQUE NOT NULL REFERENCES matches(id) ON DELETE CASCADE,

    -- Submitted by
    submitted_by UUID NOT NULL REFERENCES users(id),
    submitted_role VARCHAR(50) NOT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Game Details
    weather VARCHAR(100),
    kickoff_event VARCHAR(100),

    -- Narrative
    match_summary TEXT,

    -- Verification
    verified BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP
);

CREATE INDEX idx_match_reports_match ON match_reports(match_id);

-- Match Events Table
CREATE TABLE match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id),
    team_id UUID NOT NULL REFERENCES teams(id),

    event_type match_event_type NOT NULL,
    target_player_id UUID REFERENCES players(id),

    spp_awarded INTEGER NOT NULL DEFAULT 0,
    turn_number INTEGER,
    half INTEGER,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_match_events_match ON match_events(match_id);
CREATE INDEX idx_match_events_player ON match_events(player_id);

-- ============================================================================
-- SOB (Secret Objective Bonus) TABLES
-- ============================================================================

-- SOB Definitions Table
CREATE TABLE sob_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,

    -- SOB Details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    timeframe sob_timeframe NOT NULL,
    points_value INTEGER NOT NULL CHECK (points_value >= 1 AND points_value <= 128),

    -- Review Status
    status sob_status NOT NULL DEFAULT 'proposed',
    review_notes TEXT,

    -- Tracking
    times_achieved INTEGER NOT NULL DEFAULT 0,

    -- Meta
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMP,

    UNIQUE(team_id, season_number, title)
);

CREATE INDEX idx_sob_definitions_team ON sob_definitions(team_id);
CREATE INDEX idx_sob_definitions_status ON sob_definitions(status);

-- SOB Reviews Table
CREATE TABLE sob_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sob_definition_id UUID NOT NULL REFERENCES sob_definitions(id) ON DELETE CASCADE,
    reviewer_user_id UUID NOT NULL REFERENCES users(id),

    decision sob_review_decision NOT NULL,
    amended_title VARCHAR(255),
    amended_description TEXT,
    amended_points INTEGER,
    notes TEXT,

    reviewed_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(sob_definition_id, reviewer_user_id)
);

CREATE INDEX idx_sob_reviews_definition ON sob_reviews(sob_definition_id);
CREATE INDEX idx_sob_reviews_reviewer ON sob_reviews(reviewer_user_id);

-- SOB Achievements Table
CREATE TABLE sob_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sob_definition_id UUID NOT NULL REFERENCES sob_definitions(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,

    -- SOB Conversion
    raw_points INTEGER NOT NULL,
    converted_sobs INTEGER NOT NULL,

    achieved_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Verification
    verified BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES users(id)
);

CREATE INDEX idx_sob_achievements_definition ON sob_achievements(sob_definition_id);
CREATE INDEX idx_sob_achievements_player ON sob_achievements(player_id);
CREATE INDEX idx_sob_achievements_match ON sob_achievements(match_id);

-- ============================================================================
-- BOUNTY & SCHEDULE TABLES
-- ============================================================================

-- Bounties Table
CREATE TABLE bounties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id),

    bounty_type bounty_type NOT NULL,
    base_amount INTEGER NOT NULL,
    bonus_amount INTEGER NOT NULL DEFAULT 0,
    additional_incentives TEXT,

    status bounty_status NOT NULL DEFAULT 'active',

    posted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    posted_by UUID REFERENCES users(id),
    expires_at TIMESTAMP,

    claimed_by UUID REFERENCES users(id),
    claimed_at TIMESTAMP
);

CREATE INDEX idx_bounties_match ON bounties(match_id);
CREATE INDEX idx_bounties_status ON bounties(status);

-- Schedules Table
CREATE TABLE schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,

    -- Schedule metadata
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    playoff_start DATE,

    -- Configuration
    schedule_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),

    UNIQUE(league_id, season_number)
);

CREATE INDEX idx_schedules_league ON schedules(league_id);

-- ============================================================================
-- AI ASSISTANT & AWARDS TABLES
-- ============================================================================

-- Assistant Coach Config Table
CREATE TABLE assistant_coach_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID UNIQUE NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

    -- Assistant Details
    name VARCHAR(255) NOT NULL,
    personality_prompt TEXT NOT NULL,
    tone VARCHAR(50) DEFAULT 'friendly',
    strictness VARCHAR(50) DEFAULT 'medium',

    -- Usage & Control
    enabled BOOLEAN NOT NULL DEFAULT true,
    token_budget INTEGER DEFAULT 100000,
    tokens_used INTEGER NOT NULL DEFAULT 0,

    -- Moderation
    flagged BOOLEAN NOT NULL DEFAULT false,
    flag_reason TEXT,

    -- Meta
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assistant_coach_team ON assistant_coach_config(team_id);

-- Awards Table
CREATE TABLE awards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,

    award_type VARCHAR(100) NOT NULL,
    recipient_type award_recipient_type NOT NULL,
    recipient_id UUID NOT NULL,

    awarded_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(league_id, season_number, award_type)
);

CREATE INDEX idx_awards_league ON awards(league_id);
CREATE INDEX idx_awards_season ON awards(season_number);

-- Award Votes Table
CREATE TABLE award_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    award_type VARCHAR(100) NOT NULL,

    voter_user_id UUID NOT NULL REFERENCES users(id),
    vote_weight INTEGER NOT NULL DEFAULT 1,

    nominee_type award_recipient_type NOT NULL,
    nominee_id UUID NOT NULL,

    voted_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(league_id, season_number, award_type, voter_user_id, nominee_id)
);

CREATE INDEX idx_award_votes_league ON award_votes(league_id);
CREATE INDEX idx_award_votes_voter ON award_votes(voter_user_id);

-- Player of Week Submissions Table
CREATE TABLE player_of_week_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    week_number INTEGER NOT NULL,

    player_id UUID NOT NULL REFERENCES players(id),
    match_id UUID NOT NULL REFERENCES matches(id),

    story TEXT NOT NULL,
    submitted_by UUID NOT NULL REFERENCES users(id),
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Voting results
    votes_received INTEGER NOT NULL DEFAULT 0,
    winner BOOLEAN NOT NULL DEFAULT false,

    UNIQUE(match_id, player_id)
);

CREATE INDEX idx_pow_submissions_league ON player_of_week_submissions(league_id);
CREATE INDEX idx_pow_submissions_season ON player_of_week_submissions(season_number, week_number);

-- ============================================================================
-- AUDIT & VISITOR TABLES
-- ============================================================================

-- Audit Log Table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,

    user_id UUID NOT NULL REFERENCES users(id),
    role_context VARCHAR(100) NOT NULL,

    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,

    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_league_created ON audit_log(league_id, created_at);
CREATE INDEX idx_audit_log_user_created ON audit_log(user_id, created_at);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Visitor Teams Table
CREATE TABLE visitor_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,

    -- Static roster configuration
    roster_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(league_id)
);

CREATE INDEX idx_visitor_teams_league ON visitor_teams(league_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assistant_coach_updated_at BEFORE UPDATE ON assistant_coach_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
