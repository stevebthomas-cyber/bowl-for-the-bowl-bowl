drop extension if exists "pg_net";

alter table "public"."matches" drop constraint "matches_team_or_slot_check";

alter table "public"."advancement_costs" enable row level security;

alter table "public"."matches" alter column "away_team_id" set not null;

alter table "public"."matches" alter column "home_team_id" set not null;

alter table "public"."matches" alter column "scheduled_date" set not null;


