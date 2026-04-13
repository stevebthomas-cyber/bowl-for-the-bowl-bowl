-- Add team ownership for Gnorthmen to steve (choiceminis.)
-- This creates the proper relationship between user and team

INSERT INTO team_ownership (team_id, user_id, role, can_modify_roster, can_submit_reports)
SELECT
  t.id as team_id,
  u.id as user_id,
  'owner' as role,
  true as can_modify_roster,
  true as can_submit_reports
FROM teams t
CROSS JOIN users u
WHERE t.name = 'Gnorthmen'
  AND u.discord_username = 'choiceminis.'
  AND NOT EXISTS (
    SELECT 1 FROM team_ownership o
    WHERE o.team_id = t.id AND o.user_id = u.id
  );
