-- Create roster_templates table to store team roster rules
CREATE TABLE roster_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name VARCHAR(100) NOT NULL UNIQUE,
  tier_1 VARCHAR(100),
  tier_2 VARCHAR(100),
  special_rules TEXT[],
  min_rerolls INTEGER NOT NULL DEFAULT 0,
  max_rerolls INTEGER NOT NULL DEFAULT 8,
  reroll_cost INTEGER NOT NULL,
  apothecary_allowed BOOLEAN NOT NULL DEFAULT true,
  apothecary_cost INTEGER NOT NULL DEFAULT 50000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create roster_positions table to store available positions for each roster
CREATE TABLE roster_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_template_id UUID NOT NULL REFERENCES roster_templates(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  max_quantity INTEGER NOT NULL,
  position_name VARCHAR(100) NOT NULL,
  position_type VARCHAR(50) NOT NULL,
  race VARCHAR(50) NOT NULL,
  cost INTEGER NOT NULL,
  ma INTEGER NOT NULL,
  st INTEGER NOT NULL,
  ag INTEGER NOT NULL,
  pa INTEGER,
  av INTEGER NOT NULL,
  skills TEXT[],
  primary_skills TEXT[],
  secondary_skills TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(roster_template_id, position_name)
);

-- Add indexes for efficient querying
CREATE INDEX idx_roster_positions_template_id ON roster_positions(roster_template_id);
CREATE INDEX idx_roster_templates_team_name ON roster_templates(team_name);

-- Comments
COMMENT ON TABLE roster_templates IS 'Defines the roster rules for each Blood Bowl team type';
COMMENT ON TABLE roster_positions IS 'Defines the available positions for each roster template';
COMMENT ON COLUMN roster_templates.tier_1 IS 'Primary league tier (for inducements/star players)';
COMMENT ON COLUMN roster_templates.tier_2 IS 'Secondary league tier (for inducements/star players)';
COMMENT ON COLUMN roster_templates.special_rules IS 'Array of special rules that affect this team';
COMMENT ON COLUMN roster_positions.min_quantity IS 'Minimum number of this position required';
COMMENT ON COLUMN roster_positions.max_quantity IS 'Maximum number of this position allowed';
COMMENT ON COLUMN roster_positions.pa IS 'Passing stat (null if position cannot pass)';
COMMENT ON COLUMN roster_positions.skills IS 'Starting skills for this position';
COMMENT ON COLUMN roster_positions.primary_skills IS 'Primary skill categories for advancement';
COMMENT ON COLUMN roster_positions.secondary_skills IS 'Secondary skill categories for advancement';
