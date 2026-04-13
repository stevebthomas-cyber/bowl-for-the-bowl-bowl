/**
 * Migration: Update High Elf Rosters
 *
 * 1. Rename the existing "High Elf" roster to "High Elf (Roster of Legend)"
 *    to preserve the classic roster for legacy leagues.
 * 2. Insert the new "High Elf" Caledor Dragons roster from Spike! Journal #21
 *    with updated positions: Lineman, Phoenix Warrior, White Lion, Dragon Prince.
 *
 * Cost estimates based on Spike! Journal #21. Verify against official FAQ if needed.
 */

-- ============================================================
-- Step 1: Rename existing High Elf → High Elf (Roster of Legend)
-- ============================================================
UPDATE roster_templates
SET team_name = 'High Elf (Roster of Legend)'
WHERE team_name = 'High Elf';

-- Also update the position names to match the new template name
UPDATE roster_positions
SET position_name = REPLACE(position_name, 'High Elf ', 'High Elf (Roster of Legend) ')
WHERE roster_template_id = (
  SELECT id FROM roster_templates WHERE team_name = 'High Elf (Roster of Legend)'
);

-- ============================================================
-- Step 2: Insert new High Elf (Caledor Dragons) roster template
-- ============================================================
INSERT INTO roster_templates (
  team_name,
  tier_1,
  tier_2,
  special_rules,
  min_rerolls,
  max_rerolls,
  reroll_cost,
  apothecary_allowed,
  apothecary_cost,
  primary_league_name
) VALUES (
  'High Elf',
  'Elven Kingdom Leagues',
  NULL,
  ARRAY['Spectacle of the Flame Eternal'],
  0,
  8,
  50000,
  true,
  50000,
  'Elven Kingdom Leagues'
);

-- ============================================================
-- Step 3: Insert positions for the new High Elf roster
-- ============================================================
INSERT INTO roster_positions (
  roster_template_id,
  min_quantity,
  max_quantity,
  position_name,
  position_type,
  race,
  cost,
  ma,
  st,
  ag,
  pa,
  av,
  skills,
  primary_skills,
  secondary_skills
)
SELECT
  rt.id,
  pos.min_quantity,
  pos.max_quantity,
  pos.position_name,
  pos.position_type,
  pos.race,
  pos.cost,
  pos.ma,
  pos.st,
  pos.ag,
  pos.pa,
  pos.av,
  pos.skills,
  pos.primary_skills,
  pos.secondary_skills
FROM roster_templates rt
CROSS JOIN (VALUES
  -- High Elf Lineman: MA6 ST3 AG2+ PA3+ AV9+, no starting skills
  (0, 16, 'High Elf Lineman',  'Lineman', 'Elf', 70000,  6, 3, 2, 3,    9, ARRAY[]::text[], ARRAY['Agility','General']::text[],          ARRAY['Strength','Passing']::text[]),
  -- Phoenix Warrior: MA6 ST3 AG2+ PA2+ AV9+, Cloud Burster + Pass + Secure Pass
  (0, 2,  'Phoenix Warrior',   'Thrower', 'Elf', 110000, 6, 3, 2, 2,    9, ARRAY['Cloud Burster','Pass','Secure Pass']::text[], ARRAY['Agility','General','Passing']::text[], ARRAY['Strength']::text[]),
  -- White Lion: MA7 ST3 AG2+ PA- AV9+, Claws (cage-cracker)
  (0, 2,  'White Lion',        'Blitzer', 'Elf', 120000, 7, 3, 2, NULL, 9, ARRAY['Claws']::text[],                          ARRAY['Agility','General','Strength']::text[], ARRAY['Passing']::text[]),
  -- Dragon Prince: MA7 ST3 AG2+ PA3+ AV9+, Block + Steady Footing
  (0, 2,  'Dragon Prince',     'Blitzer', 'Elf', 115000, 7, 3, 2, 3,    9, ARRAY['Block','Steady Footing']::text[],         ARRAY['Agility','General']::text[],            ARRAY['Strength','Passing']::text[])
) AS pos(min_quantity, max_quantity, position_name, position_type, race, cost, ma, st, ag, pa, av, skills, primary_skills, secondary_skills)
WHERE rt.team_name = 'High Elf';
