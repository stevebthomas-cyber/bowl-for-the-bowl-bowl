-- Add memorial name column to teams table for customizable dead player memorial
ALTER TABLE teams ADD COLUMN memorial_name TEXT;

-- Set default memorial name based on race (can be customized by coach)
UPDATE teams SET memorial_name = 'The Honored Dead' WHERE memorial_name IS NULL;
