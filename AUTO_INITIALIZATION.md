# League Auto-Initialization

## Overview

The Blood Bowl League Management System now automatically initializes league infrastructure when the first user authenticates. This eliminates the need for manual league creation and aligns with the architecture principle that **League = Infrastructure/Deployment**.

## How It Works

### 1. User Authentication Flow

```
User clicks "Login with Discord"
    ↓
Discord OAuth callback
    ↓
exchangeCodeForToken() - Get Discord access token
    ↓
getDiscordUser() - Fetch Discord user info
    ↓
syncUserWithDatabase() - Create/update user in database
    ↓
ensureLeagueExists() - AUTO-INITIALIZE LEAGUE IF NEEDED ✨
    ↓
Fetch user roles (now includes auto-granted roles)
    ↓
Login complete - User has commissioner + coach roles
```

### 2. Auto-Initialization Logic

**File:** `packages/web-app/src/lib/league-init.ts`

```typescript
export async function ensureLeagueExists(userId: string): Promise<void> {
  // 1. Check if league already exists
  const { data: existingLeague } = await supabase
    .from('leagues')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existingLeague) {
    return; // League exists, nothing to do
  }

  // 2. Create league with default settings
  const { data: league } = await supabase
    .from('leagues')
    .insert({
      name: 'Blood Bowl League',
      season_number: 1,
      season_status: 'pre-season',
      commissioner_id: userId,
      // ... default settings ...
    })
    .select()
    .single();

  // 3. Grant commissioner + coach roles to first user
  await supabase
    .from('user_roles')
    .insert([
      { league_id: league.id, user_id: userId, role: 'commissioner', granted_by: userId },
      { league_id: league.id, user_id: userId, role: 'coach', granted_by: userId },
    ]);

  console.log('✓ League infrastructure initialized successfully');
}
```

### 3. Integration Point

**File:** `packages/web-app/src/lib/auth.ts`

The `syncUserWithDatabase()` function now calls `ensureLeagueExists()` after creating/syncing the user:

```typescript
export async function syncUserWithDatabase(discordUser: DiscordUser): Promise<AuthenticatedUser> {
  // Create or update user
  let userId: string;
  // ... user creation/update logic ...

  // Auto-initialize league infrastructure if it doesn't exist
  // This grants roles to the first user automatically
  await ensureLeagueExists(userId);

  // Fetch user roles (re-fetch after potential league creation)
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('league_id, role')
    .eq('user_id', userId);

  // ... return authenticated user with roles ...
}
```

## Default League Settings

When auto-initialized, the league is created with these defaults:

```typescript
{
  name: 'Blood Bowl League',
  season_number: 1,
  season_status: 'pre-season',
  max_teams: 8,
  min_teams: 4,
  divisions: 1,
  games_per_season: 10,
  win_points: 3,
  tie_points: 1,
  loss_points: 0,
  attendance_threshold: 3,
  playoff_format: 'top_4_bracket',
  playoff_seeding: 'by_points',
  home_advantage: false,
  starting_treasury: 1000000,
}
```

These can be changed later via `/commissioner/settings`.

## First User Privileges

The first user to authenticate automatically receives:

1. **Commissioner role** - Full administrative access
2. **Coach role** - Can create and manage a team

This ensures the league has an administrator from the start.

## Preventing Duplicate Leagues

### Protection 1: Check Before Creating

`ensureLeagueExists()` always checks if a league exists before attempting to create one:

```typescript
const { data: existingLeague } = await supabase
  .from('leagues')
  .select('id')
  .limit(1)
  .maybeSingle();

if (existingLeague) {
  return; // Early exit if league exists
}
```

### Protection 2: Initial Setup Page

The `/initial-setup` page now redirects users if a league already exists:

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

This prevents accidental duplicate league creation via the manual setup wizard.

## User Experience

### First User (Fresh Deployment)

1. Clicks "Login with Discord"
2. Completes Discord OAuth
3. **League auto-creates in background** ✨
4. Receives commissioner + coach roles automatically
5. Redirected to dashboard
6. Sees both "Commissioner" and "Coach" cards
7. Can immediately start managing the league

### Subsequent Users

1. Clicks "Login with Discord"
2. Completes Discord OAuth
3. League already exists (no action taken)
4. Has no roles by default
5. Redirected to dashboard
6. Sees message: "Contact commissioner to join"
7. Uses Discord bot `/register-coach` or waits for commissioner to grant role

## Benefits

1. **Zero-configuration deployment** - Just deploy and users can start using it
2. **No manual setup required** - League infrastructure appears automatically
3. **Prevents setup mistakes** - No chance of forgetting to create league
4. **Consistent with architecture** - League truly IS the infrastructure
5. **First user is always admin** - Ensures someone has access to manage things

## Files Modified

1. **Created:** `packages/web-app/src/lib/league-init.ts`
   - New file with `ensureLeagueExists()` function

2. **Modified:** `packages/web-app/src/lib/auth.ts`
   - Added import of `ensureLeagueExists`
   - Added call to `ensureLeagueExists(userId)` in `syncUserWithDatabase()`

3. **Modified:** `packages/web-app/src/pages/InitialSetupPage.tsx`
   - Added `useEffect` to check for existing league
   - Redirects to dashboard if league exists
   - Shows loading spinner during check

4. **Updated:** `LEAGUE_VS_SEASON.md`
   - Documented auto-initialization flow
   - Updated user flows
   - Marked manual setup as deprecated/fallback

## Testing the Implementation

To verify auto-initialization works:

1. Clear the database: `npm run db:reset` (if needed)
2. Start the web app: `npm run dev:web`
3. Click "Login with Discord"
4. Complete OAuth flow
5. Check database: `SELECT * FROM leagues;` should show 1 row
6. Check roles: `SELECT * FROM user_roles;` should show 2 rows (commissioner + coach)
7. Dashboard should show both Commissioner and Coach cards

## Future Enhancements

### Custom Default Settings

Could allow environment variables to override defaults:

```typescript
const league = {
  name: process.env.LEAGUE_NAME || 'Blood Bowl League',
  max_teams: parseInt(process.env.MAX_TEAMS || '8'),
  // ... etc
};
```

### Multi-Tenant Support

If supporting multiple Discord servers in the future, could use Discord guild ID:

```typescript
await ensureLeagueExists(userId, discordGuildId);
```

### Setup Wizard for First User

Could redirect first user to a settings page after auto-initialization:

```typescript
if (wasJustCreated) {
  navigate('/commissioner/settings?welcome=true');
}
```

## Summary

League auto-initialization transforms the setup experience from:

**Before:**
- User logs in
- Sees "No league found"
- Manually creates league via wizard
- Gets roles

**After:**
- User logs in
- League infrastructure appears automatically
- First user gets admin access
- Ready to use immediately

This aligns perfectly with the principle that **the league IS the infrastructure**, not something users create.
