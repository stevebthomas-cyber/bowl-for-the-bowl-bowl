#!/bin/bash
set -e

echo "========================================="
echo "Team Creation System Setup"
echo "========================================="
echo ""

# Check Docker is running
echo "Step 1: Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "Please start Docker Desktop and run this script again."
    exit 1
fi
echo "✓ Docker is running"
echo ""

# Start Supabase
echo "Step 2: Starting Supabase..."
supabase start
echo "✓ Supabase started"
echo ""

# Apply migrations
echo "Step 3: Applying database migrations..."
supabase db reset --db-only
echo "✓ Migrations applied"
echo ""

# Get service role key
echo "Step 4: Getting Supabase credentials..."
export SUPABASE_SERVICE_ROLE_KEY=$(supabase status | grep 'service_role key' | awk '{print $4}')

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Could not get service role key!"
    echo "Please get it manually with: supabase status"
    exit 1
fi
echo "✓ Got service role key"
echo ""

# Import roster data
echo "Step 5: Importing roster data from Excel..."
cd packages/database
node scripts/import-rosters.js
cd ../..
echo "✓ Roster data imported"
echo ""

echo "========================================="
echo "✓ Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Start the web app: npm run dev:web"
echo "2. Navigate to /coach/create-team"
echo "3. Create your first team!"
echo ""
echo "See TEAM_CREATION_SETUP.md for more details."
