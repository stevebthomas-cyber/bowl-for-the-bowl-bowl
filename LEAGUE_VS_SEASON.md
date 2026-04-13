# League vs Season Architecture

This document clarifies the distinction between "League" and "Season" in the Blood Bowl League Management System.

## The Key Insight

**League = Infrastructure/Deployment**
**Season = Competition Instance**

## Detailed Explanation

### League (Infrastructure)
- **Definition:** The permanent organizational structure and deployment instance
- **Cardinality:** Exactly ONE league per deployment
- **Created:** Once during initial setup
- **Contains:**
  - League name
  - Base rules (scoring system, playoff formats)
  - Persistent settings
  - Historical data across all seasons
- **Never deleted or recreated**

### Season (Competition)
- **Definition:** A specific competition with a beginning and end
- **Cardinality:** MANY seasons within one league
- **Created:** By commissioner when starting a new competition
- **Contains:**
  - Season number (1, 2, 3, ...)
  - Season status (pre-season, in-season, post-season, completed)
  - Current teams and rosters
  - Match results
  - Standings
- **Lifecycle:**
  1. Pre-season: Teams sign up, commissioner configures
  2. In-season: Matches are played
  3. Post-season: Playoffs occur
  4. Completed: Season archived, ready for next season

## What This Means for the Code

### Auto-Initialization (Automatic)
- **Purpose:** One-time league infrastructure creation
- **When:** First user authentication (automatic)
- **Creates:**
  - The league record in database
  - First season (Season 1)
  - Commissioner + Coach roles for first user
- **Implementation:** `ensureLeagueExists()` in `lib/league-init.ts`
- **Called from:** `syncUserWithDatabase()` in `lib/auth.ts`

### Initial Setup (`/initial-setup`) - DEPRECATED
- **Status:** Fallback only, protected against duplicate leagues
- **Purpose:** Manual league creation if auto-init fails
- **URL:** `/initial-setup`
- **Behavior:** Redirects to dashboard if league exists

### Start New Season (`/commissioner/new-season`)
- **Purpose:** Begin a new competition season
- **Who uses it:** Commissioner (recurring action)
- **Does:**
  1. Archives current season data
  2. Resets team stats (wins/losses)
  3. Clears match history
  4. Increments season number
  5. Sets status to pre-season
- **URL:** `/commissioner/new-season`
- **Used repeatedly throughout league life**

## Database Implications

### leagues Table
```sql
CREATE TABLE leagues (
  id UUID PRIMARY KEY,
  name VARCHAR(200),              -- League name (permanent)
  season_number INTEGER,          -- Current season (increments)
  season_status VARCHAR(20),      -- Current season state
  -- Base rules (can be edited between seasons)
  win_points INTEGER,
  tie_points INTEGER,
  playoff_format VARCHAR(50),
  -- etc.
);
```

**Important:** There should always be exactly 1 row in this table after initial setup.

### Checking for League
```typescript
// ❌ WRONG: Treating "no league" as a normal state
if (!league) {
  return <CreateLeagueButton />;
}

// ✅ CORRECT: "No league" is a setup error
if (!league) {
  return <div>System not configured. Contact admin.</div>;
}

// ✅ CORRECT: Check season state instead
if (!league.season_status || league.season_status === 'completed') {
  return <div>No active season. Wait for commissioner to start new season.</div>;
}
```

## User Flows

### First-Time Setup (Automatic)
1. User logs in via Discord OAuth
2. System auto-creates league infrastructure + Season 1
3. First user gets commissioner + coach roles automatically
4. League is now operational
5. User redirected to dashboard with both roles

### Regular Season Cycle
1. Commissioner starts new season (`/commissioner/new-season`)
2. Status: `pre-season` - Coaches join/create teams
3. Commissioner starts season → Status: `in-season`
4. Matches are played
5. Playoffs occur → Status: `post-season`
6. Season ends → Status: `completed`
7. **Repeat:** Commissioner starts next season

### Coach Joining
- **If league not set up:** See error "System not configured"
- **If no season active:** See message "No active season"
- **If pre-season:** Can create team, join league
- **If in-season:** Can create team if commissioner allows mid-season joins

### Team Creation
- **Requires:** Active league AND active season (not completed)
- **Blocked if:** Season is completed or doesn't exist
- **Allowed in:** pre-season, in-season (if commissioner permits)

## UI/UX Implications

### Dashboard for Users Without Roles
- **OLD (Wrong):** "Create a New League" button
- **NEW (Correct):** "Contact commissioner to join" message

### Error Messages
- **"No league found"** → "League not set up" (system error)
- **"No active season"** → Normal state between seasons
- **"Season completed"** → Wait for new season

### Navigation
- Remove "Create League" from normal user flows
- Only accessible via direct URL for initial setup
- Consider adding admin protection to `/initial-setup`

## Code Changes Made

1. **Created:** `lib/league-init.ts` with `ensureLeagueExists()` auto-initialization
2. **Modified:** `lib/auth.ts` to call `ensureLeagueExists()` on user sync
3. **Renamed:** `CreateLeaguePage` → `InitialSetupPage`
4. **URL Changed:** `/create-league` → `/initial-setup`
5. **Protected:** InitialSetupPage redirects if league exists
6. **Dashboard Updated:** Removed "Create League" button for users without roles
7. **CreateTeamPage:** Added check for active season
8. **Messaging:** Updated all references to distinguish league vs season

## Future Considerations

### Protecting Initial Setup ✅ IMPLEMENTED
InitialSetupPage now checks if league exists and redirects to dashboard:

```typescript
useEffect(() => {
  const checkLeagueExists = async () => {
    const { data: league } = await supabase
      .from('leagues')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (league) {
      navigate('/dashboard', { replace: true });
    }
  };

  checkLeagueExists();
}, [navigate]);
```

### Multi-League Support (Not Current)
If future requirements change to support multiple leagues per deployment:
- Add league_id to user context
- Add league selector to navigation
- Update all queries to filter by league_id
- This is NOT the current model

## Summary

- **League:** The permanent infrastructure (created once)
- **Season:** The recurring competition (created many times)
- **Key Check:** Don't check "is there a league?", check "is there an active season?"
- **User Experience:** Users should never need to "create a league" - they join existing league as coaches
