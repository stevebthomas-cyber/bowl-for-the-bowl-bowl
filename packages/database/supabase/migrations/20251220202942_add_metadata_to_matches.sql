-- Add metadata column to matches table to store slot information
ALTER TABLE matches ADD COLUMN metadata JSONB;

-- Add a comment explaining the column's purpose
COMMENT ON COLUMN matches.metadata IS 'Stores scheduling metadata including abstract slot identifiers (e.g., D1-S1) and match type information';
