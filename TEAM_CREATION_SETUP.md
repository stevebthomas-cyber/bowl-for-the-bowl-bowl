# Team Creation System Setup

This document explains the new team creation system for the Blood Bowl League Management web app.

## Overview

The team creation system allows coaches to create their teams through a 5-step wizard in the web app, with all roster rules enforced from the Excel data source.

## Files Created

### Database

1. **Migration: `20251219000000_add_roster_templates.sql`**
   - Creates `roster_templates` table (team metadata: reroll costs, tiers, special rules)
   - Creates `roster_positions` table (player positions with stats, costs, limits)

2. **Import Script: `packages/database/scripts/import-rosters.js`**
   - Parses the Excel file and imports all 30 rosters into the database
   - Run with: `node packages/database/scripts/import-rosters.js`
   - Requires `SUPABASE_SERVICE_ROLE_KEY` environment variable

### TypeScript Types

3. **`packages/web-app/src/types/roster.ts`**
   - `RosterTemplate` - Team roster metadata
   - `RosterPosition` - Player position details
   - `TeamCreationState` - Wizard state management
   - Constants for staff costs and limits

### API Layer

4. **`packages/web-app/src/lib/roster-queries.ts`**
   - `getAllRosterTemplates()` - Fetch all available rosters
   - `getRosterTemplate(id)` - Fetch single roster
   - `getRosterPositions(rosterTemplateId)` - Fetch positions for a roster
   - `getRosterWithPositions(rosterTemplateId)` - Fetch roster with all positions

### UI Components

5. **`packages/web-app/src/pages/coach/CreateTeamPage.tsx`**
   - Full 5-step wizard for team creation
   - Step 1: Choose race (30 roster options)
   - Step 2: Name your team
   - Step 3: Buy players (with position limits and budget tracking)
   - Step 4: Buy rerolls and staff (rerolls, apothecary, coaches, cheerleaders, fans)
   - Step 5: Review and confirm

### Routing

6. **Updated `packages/web-app/src/App.tsx`**
   - Added route: `/coach/create-team`
   - Protected with `requireCoach` guard

7. **Updated `packages/web-app/src/pages/coach/CoachDashboard.tsx`**
   - Added "Create Your Team" button for coaches without teams

## Setup Instructions

### 1. Install Dependencies

```bash
npm install exceljs
```

### 2. Start Supabase and Apply Migrations

```bash
# Start Docker Desktop first!
supabase start

# Reset database to apply new migrations
supabase db reset
```

### 3. Import Roster Data

```bash
# Set environment variable (get from supabase status)
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run import script
node packages/database/scripts/import-rosters.js
```

Expected output:
```
✓ Inserted 30 roster templates
✓ Inserted 180+ roster positions
```

### 4. Update League Settings

The migration adds a `starting_treasury` column to the `leagues` table (default: 1,000,000).

You can update this in the League Settings page or via SQL:
```sql
UPDATE leagues SET starting_treasury = 1000000 WHERE id = 'your-league-id';
```

## Team Creation Rules Enforced

Based on your requirements:

### Player Roster Rules
- **Min Players:** 11 (configurable via `STAFF_LIMITS.MIN_PLAYERS`)
- **Max Players:** 16 (configurable via `STAFF_LIMITS.MAX_PLAYERS_STANDARD`)
- **Position Limits:** Enforced from roster_positions (min_quantity, max_quantity)

### Budget Rules
- **Starting Treasury:** From league settings (default 1M)
- **Real-time Budget Tracking:** Shows remaining treasury as you purchase

### Reroll Rules
- **Cost:** From roster template (varies by team)
- **Min/Max:** Enforced from roster template
- **Note:** System warns that rerolls cost double after creation

### Staff Rules
- **Apothecary:** 50,000 (only if allowed for roster)
- **Assistant Coaches:** 10,000 each (max 6)
- **Cheerleaders:** 10,000 each (max 6)
- **Dedicated Fans:** First is free, then 5,000 each (max 3 additional)

### Special Rules
- Team tiers stored for inducements/star players
- Special rules array stored for SPP/inducement effects

## Data Model

### roster_templates
```sql
- id (UUID)
- team_name (VARCHAR) - e.g., "Human", "Orc"
- tier_1 (VARCHAR) - Primary league tier
- tier_2 (VARCHAR) - Secondary league tier
- special_rules (TEXT[]) - Array of special rules
- min_rerolls (INTEGER) - Minimum rerolls required
- max_rerolls (INTEGER) - Maximum rerolls allowed
- reroll_cost (INTEGER) - Cost per reroll in gold
- apothecary_allowed (BOOLEAN)
- apothecary_cost (INTEGER) - Default 50,000
```

### roster_positions
```sql
- id (UUID)
- roster_template_id (UUID FK)
- min_quantity (INTEGER) - Min of this position required
- max_quantity (INTEGER) - Max of this position allowed
- position_name (VARCHAR) - e.g., "Human Lineman"
- position_type (VARCHAR) - e.g., "Lineman", "Blitzer"
- race (VARCHAR) - e.g., "Human"
- cost (INTEGER) - Hiring cost in gold
- ma, st, ag, pa, av (INTEGER) - Stats
- skills (TEXT[]) - Starting skills
- primary_skills (TEXT[]) - Primary advancement categories
- secondary_skills (TEXT[]) - Secondary advancement categories
```

## Testing Checklist

Once setup is complete:

1. [ ] Navigate to `/coach/create-team`
2. [ ] Verify all 30 rosters are visible in Step 1
3. [ ] Select a roster and verify positions load
4. [ ] Try to buy players beyond position limits (should be prevented)
5. [ ] Try to buy more than 16 players (should be prevented)
6. [ ] Try to proceed with less than 11 players (should be prevented)
7. [ ] Verify treasury updates in real-time
8. [ ] Buy rerolls and staff, verify costs are correct
9. [ ] Complete team creation and verify team appears in dashboard
10. [ ] Verify players are created in database

## Future Enhancements

- [ ] Support for "cheap lineman rule" (Ogres, Snotlings can exceed 16 players)
- [ ] Add roster images/icons
- [ ] Save draft teams (incomplete team creation)
- [ ] Team import from Discord bot format
- [ ] Validation against league tier restrictions (if implemented)

## Notes

- The Excel file path is hardcoded in the import script: `/Users/steve/Documents/Blood-Bowl-Manager/Fantasy Football Information.xlsx`
- To update rosters: Edit Excel file, then re-run import script
- The import script clears existing roster data before importing
- Star Players are NOT available during team creation (inducements only)
