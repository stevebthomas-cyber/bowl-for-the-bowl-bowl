-- Add RLS policies for all remaining tables
-- For development/private league use, we're using permissive policies

-- Players table
ALTER TABLE IF EXISTS players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to players" ON players;
CREATE POLICY "Allow public access to players" ON players FOR ALL USING (true) WITH CHECK (true);

-- Matches table
ALTER TABLE IF EXISTS matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to matches" ON matches;
CREATE POLICY "Allow public access to matches" ON matches FOR ALL USING (true) WITH CHECK (true);

-- Venues table
ALTER TABLE IF EXISTS venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to venues" ON venues;
CREATE POLICY "Allow public access to venues" ON venues FOR ALL USING (true) WITH CHECK (true);

-- Pitches table
ALTER TABLE IF EXISTS pitches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to pitches" ON pitches;
CREATE POLICY "Allow public access to pitches" ON pitches FOR ALL USING (true) WITH CHECK (true);

-- Seasons table
ALTER TABLE IF EXISTS seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to seasons" ON seasons;
CREATE POLICY "Allow public access to seasons" ON seasons FOR ALL USING (true) WITH CHECK (true);

-- Date schedules table
ALTER TABLE IF EXISTS date_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to date_schedules" ON date_schedules;
CREATE POLICY "Allow public access to date_schedules" ON date_schedules FOR ALL USING (true) WITH CHECK (true);

-- Blackout dates table
ALTER TABLE IF EXISTS blackout_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to blackout_dates" ON blackout_dates;
CREATE POLICY "Allow public access to blackout_dates" ON blackout_dates FOR ALL USING (true) WITH CHECK (true);

-- Roster templates table
ALTER TABLE IF EXISTS roster_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to roster_templates" ON roster_templates;
CREATE POLICY "Allow public access to roster_templates" ON roster_templates FOR ALL USING (true) WITH CHECK (true);

-- Skills table
ALTER TABLE IF EXISTS skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to skills" ON skills;
CREATE POLICY "Allow public access to skills" ON skills FOR ALL USING (true) WITH CHECK (true);

-- Traits table
ALTER TABLE IF EXISTS traits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to traits" ON traits;
CREATE POLICY "Allow public access to traits" ON traits FOR ALL USING (true) WITH CHECK (true);

-- Star players table
ALTER TABLE IF EXISTS star_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to star_players" ON star_players;
CREATE POLICY "Allow public access to star_players" ON star_players FOR ALL USING (true) WITH CHECK (true);

-- Inducements table
ALTER TABLE IF EXISTS inducements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to inducements" ON inducements;
CREATE POLICY "Allow public access to inducements" ON inducements FOR ALL USING (true) WITH CHECK (true);

-- Games table
ALTER TABLE IF EXISTS games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to games" ON games;
CREATE POLICY "Allow public access to games" ON games FOR ALL USING (true) WITH CHECK (true);

-- Game snapshots table
ALTER TABLE IF EXISTS game_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to game_snapshots" ON game_snapshots;
CREATE POLICY "Allow public access to game_snapshots" ON game_snapshots FOR ALL USING (true) WITH CHECK (true);

-- Season archives table
ALTER TABLE IF EXISTS season_archives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to season_archives" ON season_archives;
CREATE POLICY "Allow public access to season_archives" ON season_archives FOR ALL USING (true) WITH CHECK (true);
