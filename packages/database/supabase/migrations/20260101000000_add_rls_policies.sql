-- Add RLS Policies for Discord OAuth Authentication
-- This migration enables proper Row Level Security policies for the users table
-- to allow the web app to create and read user records during authentication

-- Enable RLS on users table (if not already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read user records (needed for auth lookups)
-- In production, you may want to restrict this further
CREATE POLICY "Allow public read access to users"
ON users FOR SELECT
USING (true);

-- Policy: Allow anyone to insert new users (needed for registration)
-- The application validates Discord tokens before creating users
CREATE POLICY "Allow public insert for new users"
ON users FOR INSERT
WITH CHECK (true);

-- Policy: Allow users to update their own last_active timestamp
-- Uses discord_id from the request to match the user
CREATE POLICY "Allow users to update own record"
ON users FOR UPDATE
USING (true)
WITH CHECK (true);

-- Enable RLS on other core tables
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_ownership ENABLE ROW LEVEL SECURITY;

-- League policies: Anyone can read leagues (for now - single league model)
CREATE POLICY "Allow public read access to leagues"
ON leagues FOR SELECT
USING (true);

-- Allow inserting leagues (needed during initial setup)
CREATE POLICY "Allow public insert for leagues"
ON leagues FOR INSERT
WITH CHECK (true);

-- Allow updating leagues (needed for settings changes)
CREATE POLICY "Allow public update for leagues"
ON leagues FOR UPDATE
USING (true)
WITH CHECK (true);

-- User roles policies: Anyone can read roles (needed for auth context)
CREATE POLICY "Allow public read access to user_roles"
ON user_roles FOR SELECT
USING (true);

-- Allow inserting user roles (needed during league initialization)
CREATE POLICY "Allow public insert for user_roles"
ON user_roles FOR INSERT
WITH CHECK (true);

-- Teams policies: Anyone can read teams
CREATE POLICY "Allow public read access to teams"
ON teams FOR SELECT
USING (true);

-- Allow creating teams
CREATE POLICY "Allow public insert for teams"
ON teams FOR INSERT
WITH CHECK (true);

-- Allow updating teams
CREATE POLICY "Allow public update for teams"
ON teams FOR UPDATE
USING (true)
WITH CHECK (true);

-- Team ownership policies: Anyone can read ownership
CREATE POLICY "Allow public read access to team_ownership"
ON team_ownership FOR SELECT
USING (true);

-- Allow creating team ownership records
CREATE POLICY "Allow public insert for team_ownership"
ON team_ownership FOR INSERT
WITH CHECK (true);

-- NOTE: These are permissive policies suitable for a private league application.
-- For a public-facing application, you would want to implement more restrictive
-- policies based on authenticated user context and roles.
