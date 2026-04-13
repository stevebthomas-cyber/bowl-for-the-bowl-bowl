# Blood Bowl League Management System (BBLMS)

A dual-interface platform for managing Blood Bowl tabletop leagues with Discord bot and web app.

## Project Structure

```
blood-bowl-manager/
├── packages/
│   ├── database/       # Supabase schema and migrations
│   ├── discord-bot/    # Discord bot application
│   ├── web-app/        # React web application
│   └── shared/         # Shared TypeScript types and utilities
├── package.json        # Root workspace configuration
└── README.md
```

## Development Setup

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase account (free tier)
- Discord Developer account

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up Supabase (see packages/database/README.md)

3. Configure environment variables:
   ```bash
   cp packages/discord-bot/.env.example packages/discord-bot/.env
   cp packages/web-app/.env.example packages/web-app/.env
   ```

4. Run migrations:
   ```bash
   npm run db:migrate
   ```

5. Start development servers:
   ```bash
   npm run dev:all
   ```

## Phase 1 Goals (Current)

- [x] Project structure
- [ ] Database schema
- [ ] Discord bot basic setup
- [ ] Web app basic setup
- [ ] Manual workflows (no AI)

## Tech Stack

- **Backend:** Node.js
- **Database:** PostgreSQL (Supabase)
- **Discord:** discord.js
- **Frontend:** React + Tailwind CSS
- **Deployment:** Supabase (database), TBD (apps)
