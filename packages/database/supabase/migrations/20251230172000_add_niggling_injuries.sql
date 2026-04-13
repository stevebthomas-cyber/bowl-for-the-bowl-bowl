-- Add niggling injuries counter to players table
ALTER TABLE players ADD COLUMN niggling_injuries INTEGER DEFAULT 0;
