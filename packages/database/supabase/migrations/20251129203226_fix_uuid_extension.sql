-- Fix UUID extension schema issue
-- This migration must run before all others

-- Drop the extension if it exists in the wrong schema
DROP EXTENSION IF EXISTS "uuid-ossp";

-- Create the extension explicitly in the public schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Verify the function is now accessible
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4'
  ) THEN
    RAISE EXCEPTION 'uuid_generate_v4 function not found after creating extension';
  END IF;
END $$;
