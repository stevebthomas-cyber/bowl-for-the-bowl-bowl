# Blood Bowl League Manager - Web App

React web application for managing Blood Bowl leagues with Discord authentication and role-based access.

## Features

- **Discord OAuth Authentication** - Login with your Discord account
- **Role-Based Access Control** - Separate dashboards for Commissioners and Coaches
- **Commissioner Features:**
  - View all teams in the league
  - League standings
  - League settings management
  - Schedule management (coming soon)
- **Coach Features:**
  - View and manage your team
  - View player roster
  - Submit match reports (coming soon)
  - Run friendly matches (coming soon)

## Setup Instructions

### 1. Install Dependencies

From the project root:
```bash
npm install
```

### 2. Configure Discord OAuth

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application (or use your existing bot application)
3. Navigate to **OAuth2** in the sidebar
4. Add a redirect URI: `http://localhost:5173/auth/callback`
5. Copy your **Client ID** and **Client Secret**

### 3. Configure Environment Variables

Edit `/packages/web-app/.env` and add your Discord credentials:

```bash
# Supabase Configuration (Local)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Discord OAuth
VITE_DISCORD_CLIENT_ID=your_actual_discord_client_id
VITE_DISCORD_CLIENT_SECRET=your_actual_discord_client_secret
VITE_DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
```

**Security Warning:** The Discord client secret is currently exposed in the frontend bundle. This is **NOT production-safe**. For production deployment, implement a backend API or Supabase Edge Function to handle the OAuth token exchange.

### 4. Start Supabase (if not running)

From the project root:
```bash
npm run db:start
```

### 5. Run the Web App

From the project root:
```bash
npm run dev:web
```

Or from the web-app directory:
```bash
npm run dev
```

The app will be available at: **http://localhost:5173**

## Project Structure

```
src/
├── config/          # Supabase client configuration
├── lib/             # Auth helpers and database queries
├── contexts/        # React contexts (AuthContext)
├── hooks/           # Custom hooks (useAuth, useLeague, useTeam)
├── components/      # Reusable components
│   ├── auth/        # Authentication components
│   ├── common/      # Shared components (LoadingSpinner, ErrorMessage)
│   ├── layouts/     # Page layouts (CommissionerLayout, CoachLayout)
│   └── coach/       # Coach-specific components
├── pages/           # Page components
│   ├── commissioner/  # Commissioner pages
│   └── coach/         # Coach pages
└── types/           # TypeScript type definitions
```

## User Roles

### Commissioner
- Can view all teams and league data
- Manage league settings
- Create and manage schedules (coming soon)
- Review and approve match reports (coming soon)

### Coach
- Can view and manage their own team
- View player roster
- Submit match reports (coming soon)
- Challenge other coaches to friendly matches (coming soon)

**Note:** A user can have both Commissioner and Coach roles simultaneously.

## Database Integration

The web app uses the same Supabase database as the Discord bot. Database query patterns mirror the Discord bot implementation for consistency.

**Key Tables:**
- `users` - User accounts linked to Discord IDs
- `user_roles` - Role assignments (commissioner, coach)
- `teams` - Team data
- `players` - Player rosters
- `team_ownership` - Team access control
- `leagues` - League configuration

## Authentication Flow

1. User clicks "Login with Discord" on landing page
2. Redirected to Discord OAuth authorization
3. User approves, Discord redirects back with authorization code
4. App exchanges code for access token
5. App fetches Discord user info
6. App syncs user with database (creates if new)
7. App fetches user roles and team ownership
8. User redirected to dashboard

## Development Workflow

### Running Both Bot and Web App

From the project root:
```bash
npm run dev:all
```

This starts both the Discord bot and web app in watch mode.

### Making Database Changes

1. Create a new migration in `/packages/database/supabase/migrations/`
2. Run migrations: `npm run db:migrate`
3. Regenerate TypeScript types: `npm run types` (in database package)

## Current Limitations

- **Single League Model:** Only one league per deployment
- **No Row-Level Security:** Database RLS policies not yet implemented
- **Client Secret Exposure:** Discord secret exposed in frontend (dev only)
- **Feature Placeholders:** Some features marked "coming soon"

## Next Steps

### Immediate Priorities
1. Set up Discord OAuth credentials
2. Test login flow end-to-end
3. Create test users with different roles
4. Verify role-based access works correctly

### Future Enhancements
- Implement match report submission
- Add friendly match scheduling system
- Build schedule generation wizard
- Add team management features (buy staff, fans, rerolls)
- Implement Supabase RLS policies
- Move Discord OAuth token exchange to backend
- Add real-time updates with Supabase subscriptions

## Troubleshooting

### "Missing Supabase environment variables"
- Check that `.env` file exists in `/packages/web-app/`
- Verify all `VITE_` prefixed variables are set
- Restart the dev server after changing `.env`

### "Failed to exchange code for token"
- Verify Discord Client ID and Secret are correct
- Check that redirect URI matches exactly: `http://localhost:5173/auth/callback`
- Ensure redirect URI is added in Discord Developer Portal

### "No league has been created yet"
- Use the Discord bot command `/create-league` to create a league first
- Or manually insert a league record in the database

### Database Connection Issues
- Ensure Supabase is running: `npm run db:start`
- Check that `VITE_SUPABASE_URL` points to `http://127.0.0.1:54321`
- Verify the anon key matches your local Supabase instance

## Contributing

When adding new features:
1. Follow existing patterns for database queries
2. Use TypeScript types from `@bblms/shared` package
3. Mirror Discord bot query patterns for consistency
4. Add loading and error states to all async operations
5. Update this README with new features

## License

This project is part of the Blood Bowl League Management System (BBLMS).
