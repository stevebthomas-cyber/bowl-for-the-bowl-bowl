-- Add primary_league column to roster_templates
-- This stores which league each team race is eligible to play in

ALTER TABLE roster_templates
ADD COLUMN IF NOT EXISTS primary_league_name text;

COMMENT ON COLUMN roster_templates.primary_league_name IS 'Primary league this roster is eligible to join (e.g., "Badlands Brawl", "Old World Classic")';

-- Update roster_templates with league data from Excel
UPDATE roster_templates SET primary_league_name = 'Lustrian Superleague' WHERE team_name = 'Amazon';
UPDATE roster_templates SET primary_league_name = 'Badlands Brawl' WHERE team_name = 'Black Orc';
UPDATE roster_templates SET primary_league_name = 'Old World Classic' WHERE team_name = 'Bretonnian';
UPDATE roster_templates SET primary_league_name = 'Chaos Clash' WHERE team_name = 'Chaos Chosen';
UPDATE roster_templates SET primary_league_name = 'Badlands Brawl' WHERE team_name = 'Chaos Dwarf';
UPDATE roster_templates SET primary_league_name = 'Chaos Clash' WHERE team_name = 'Chaos Renegade';
UPDATE roster_templates SET primary_league_name = 'Even Kingdoms League' WHERE team_name = 'Dark Elf';
UPDATE roster_templates SET primary_league_name = 'Worlds Edge Superleague' WHERE team_name = 'Dwarf';
UPDATE roster_templates SET primary_league_name = 'Elven Kingdoms League' WHERE team_name = 'Elven Union';
UPDATE roster_templates SET primary_league_name = 'Halfling Thimble Cup' WHERE team_name = 'Gnome';
UPDATE roster_templates SET primary_league_name = 'Badlands Brawl' WHERE team_name = 'Goblin';
UPDATE roster_templates SET primary_league_name = 'Halfling Thimble Cup' WHERE team_name = 'Halfling';
UPDATE roster_templates SET primary_league_name = 'Elven Kingdom Leagues' WHERE team_name = 'High Elf';
UPDATE roster_templates SET primary_league_name = 'Old World Classic' WHERE team_name = 'Human';
UPDATE roster_templates SET primary_league_name = 'Old World Classic' WHERE team_name = 'Imperial Nobility';
UPDATE roster_templates SET primary_league_name = 'Chaos Clash' WHERE team_name = 'Khorne';
UPDATE roster_templates SET primary_league_name = 'Lustrian Superleague' WHERE team_name = 'Lizardmen';
UPDATE roster_templates SET primary_league_name = 'Sylvanian Spotlight' WHERE team_name = 'Necromantic Horror';
UPDATE roster_templates SET primary_league_name = 'Chaos Clash' WHERE team_name = 'Norse';
UPDATE roster_templates SET primary_league_name = 'Chaos Clash' WHERE team_name = 'Nurgle';
UPDATE roster_templates SET primary_league_name = 'Badlands Brawl' WHERE team_name = 'Ogre';
UPDATE roster_templates SET primary_league_name = 'Old World Classic' WHERE team_name = 'Old World Alliance';
UPDATE roster_templates SET primary_league_name = 'Badlands Brawl' WHERE team_name = 'Orc';
UPDATE roster_templates SET primary_league_name = 'Sylvanian Spotlight' WHERE team_name = 'Shambling Undead';
UPDATE roster_templates SET primary_league_name = 'Underworld Challenge' WHERE team_name = 'Skaven';
UPDATE roster_templates SET primary_league_name = 'Underworld Challenge' WHERE team_name = 'Snotling';
UPDATE roster_templates SET primary_league_name = 'Sylvanian Spotlight' WHERE team_name = 'Tomb Kings';
UPDATE roster_templates SET primary_league_name = 'Underworld Challenge' WHERE team_name = 'Underworld Denizens';
UPDATE roster_templates SET primary_league_name = 'Sylvanian Spotlight' WHERE team_name = 'Vampire';
UPDATE roster_templates SET primary_league_name = 'Elven Kingdoms League' WHERE team_name = 'Wood Elf';
