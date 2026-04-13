-- Create skills and traits reference tables for Season 3
-- These tables store the official Blood Bowl 2020 skills and traits with descriptions

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  category varchar(50) NOT NULL, -- 'General', 'Agility', 'Strength', 'Passing', 'Mutation'
  description text NOT NULL,
  official_reference text, -- Reference to rulebook section or page
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Traits table (negative/special characteristics)
CREATE TABLE IF NOT EXISTS traits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  description text NOT NULL,
  official_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_traits_name ON traits(name);

-- Comments
COMMENT ON TABLE skills IS 'Blood Bowl 2020 skills reference with descriptions';
COMMENT ON TABLE traits IS 'Blood Bowl 2020 traits (negative skills) reference with descriptions';
COMMENT ON COLUMN skills.category IS 'Skill category: General, Agility, Strength, Passing, or Mutation';
COMMENT ON COLUMN skills.official_reference IS 'Reference to BB2020 rulebook section/page';
COMMENT ON COLUMN traits.official_reference IS 'Reference to BB2020 rulebook section/page';
