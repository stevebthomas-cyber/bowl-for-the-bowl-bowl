-- Explicitly create uuid-ossp extension in public schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Verify the extension is installed
SELECT extname, nspname 
FROM pg_extension 
JOIN pg_namespace ON pg_namespace.oid = pg_extension.extnamespace
WHERE extname = 'uuid-ossp';
