-- Add missing INSERT and UPDATE policies for leagues table

-- Allow inserting leagues (needed during initial setup)
DROP POLICY IF EXISTS "Allow public insert for leagues" ON leagues;
CREATE POLICY "Allow public insert for leagues"
ON leagues FOR INSERT
WITH CHECK (true);

-- Allow updating leagues (needed for settings changes)
DROP POLICY IF EXISTS "Allow public update for leagues" ON leagues;
CREATE POLICY "Allow public update for leagues"
ON leagues FOR UPDATE
USING (true)
WITH CHECK (true);
