-- Create special_rules_leagues table (Chaos Clash, Old World Classic, etc.)
-- This determines which star players and inducements are available

CREATE TABLE IF NOT EXISTS special_rules_leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE special_rules_leagues IS 'Blood Bowl ruleset leagues (Chaos Clash, Old World Classic, Halfling Thimblecup, etc.) that determine available star players and inducements';

-- Add special_rules_league_id to roster_templates
ALTER TABLE roster_templates
ADD COLUMN IF NOT EXISTS special_rules jsonb DEFAULT '{}';

COMMENT ON COLUMN roster_templates.special_rules IS 'Team special rules like Brawlin'' Brutes, Bribery and Corruption, etc.';

-- Add special_rules_league_id to teams table
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS special_rules_league_id uuid REFERENCES special_rules_leagues(id);

COMMENT ON COLUMN teams.special_rules_league_id IS 'Which ruleset league this team plays in (determines available star players/inducements)';
