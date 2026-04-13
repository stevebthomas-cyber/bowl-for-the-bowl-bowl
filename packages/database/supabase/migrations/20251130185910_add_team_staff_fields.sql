-- Add staff and roster tracking fields to teams table

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS assistant_coaches INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cheerleaders INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS apothecary_hired BOOLEAN NOT NULL DEFAULT false;

-- Add constraints
ALTER TABLE teams
ADD CONSTRAINT teams_assistant_coaches_check CHECK (assistant_coaches >= 0 AND assistant_coaches <= 6),
ADD CONSTRAINT teams_cheerleaders_check CHECK (cheerleaders >= 0 AND cheerleaders <= 6);

COMMENT ON COLUMN teams.assistant_coaches IS 'Number of assistant coaches hired (max 6, 10k each)';
COMMENT ON COLUMN teams.cheerleaders IS 'Number of cheerleaders hired (max 6, 10k each)';
COMMENT ON COLUMN teams.apothecary_hired IS 'Whether team has hired an apothecary (50k, max 1)';
