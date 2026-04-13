# Database Package

PostgreSQL database schema and migrations for BBLMS, managed via Supabase.

## Setup

### 1. Install Supabase CLI

```bash
npm install
```

Or install globally:
```bash
npm install -g supabase
```

### 2. Initialize Supabase (Local Development)

```bash
cd packages/database
supabase init
```

### 3. Start Local Supabase

```bash
supabase start
```

This will start:
- PostgreSQL database (localhost:54322)
- Studio UI (localhost:54323)
- API Gateway (localhost:54321)

### 4. Run Migrations

```bash
npm run migrate
```

### 5. Connect to Remote Supabase (When Ready)

1. Create a project at https://supabase.com
2. Link your local project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
3. Push migrations:
   ```bash
   supabase db push
   ```

## Migrations

Migrations are in `supabase/migrations/` and are applied in timestamp order.

### Creating a New Migration

```bash
supabase migration new your_migration_name
```

## Generating TypeScript Types

After schema changes, regenerate types:

```bash
npm run types
```

This updates `packages/shared/src/types/database.ts` with current schema types.

## Seed Data

Test data for local development goes in `supabase/seed/`.
