-- Create inducements table

CREATE TABLE IF NOT EXISTS inducements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL, -- 'mercenary', 'card', 'staff', 'reroll', etc.
  base_cost integer NOT NULL,
  bribery_corruption_cost integer, -- Cost if team has Bribery and Corruption special rule
  max_quantity integer, -- Maximum number that can be purchased (null = unlimited)
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inducements_type ON inducements(type);

COMMENT ON TABLE inducements IS 'Inducements that can be purchased with petty cash before a game';
COMMENT ON COLUMN inducements.bribery_corruption_cost IS 'Discounted cost for teams with Bribery and Corruption special rule';
