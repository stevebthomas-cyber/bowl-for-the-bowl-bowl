-- Create tables for prayers to nuffle, advancement, and game mechanics

-- Prayers to Nuffle results
CREATE TABLE IF NOT EXISTS prayers_to_nuffle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_name text NOT NULL,
  d6_result integer NOT NULL CHECK (d6_result >= 1 AND d6_result <= 6),
  effect_description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_prayers_d6_result ON prayers_to_nuffle(d6_result);

-- Random Skills Table
CREATE TABLE IF NOT EXISTS random_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_category text NOT NULL, -- 'Primary' or 'Secondary'
  d6_roll_1 integer NOT NULL CHECK (d6_roll_1 >= 1 AND d6_roll_1 <= 6),
  d6_roll_2 integer NOT NULL CHECK (d6_roll_2 >= 1 AND d6_roll_2 <= 6),
  skill_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_random_skills_rolls ON random_skills(skill_category, d6_roll_1, d6_roll_2);

-- Characteristic Improvements Table
CREATE TABLE IF NOT EXISTS characteristic_improvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  d8_roll integer NOT NULL CHECK (d8_roll >= 1 AND d8_roll <= 8) UNIQUE,
  improvement_type text NOT NULL, -- 'MA', 'ST', 'AG', 'PA', 'AV'
  improvement_value integer NOT NULL, -- Usually +1 for MA/ST, -1 for AG/PA/AV
  created_at timestamptz DEFAULT now()
);

-- Advancement Costs (based on player level/SPP)
CREATE TABLE IF NOT EXISTS advancement_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_level text NOT NULL, -- 'Rookie', 'Experienced', 'Veteran', etc.
  min_spp integer NOT NULL,
  max_spp integer,
  primary_skill_cost integer NOT NULL,
  secondary_skill_cost integer NOT NULL,
  characteristic_improvement_cost integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_advancement_costs_spp ON advancement_costs(min_spp, max_spp);

-- Expensive Mistakes Table
CREATE TABLE IF NOT EXISTS expensive_mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_min integer NOT NULL,
  treasury_max integer,
  d6_roll integer NOT NULL CHECK (d6_roll >= 1 AND d6_roll <= 6),
  outcome text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_expensive_mistakes_treasury ON expensive_mistakes(treasury_min, treasury_max);

COMMENT ON TABLE prayers_to_nuffle IS 'Prayer to Nuffle results based on d6 roll';
COMMENT ON TABLE random_skills IS 'Random skill generation table (2d6)';
COMMENT ON TABLE characteristic_improvements IS 'Characteristic improvement results (d8)';
COMMENT ON TABLE advancement_costs IS 'SPP costs for advancements based on player level';
COMMENT ON TABLE expensive_mistakes IS 'Expensive mistakes outcomes based on treasury level';
