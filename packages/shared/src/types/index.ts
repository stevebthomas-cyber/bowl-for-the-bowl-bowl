// Database types will be auto-generated here from Supabase schema
// See packages/database README for how to generate

// Placeholder for now
export type Database = Record<string, unknown>;

// Common enums from the schema
export enum SeasonStatus {
  SETUP = 'setup',
  ACTIVE = 'active',
  PLAYOFFS = 'playoffs',
  CLOSED = 'closed'
}

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  BOUNTY_POSTED = 'bounty_posted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CONCEDED = 'conceded',
  CANCELLED = 'cancelled'
}

export enum PlayerStatus {
  ACTIVE = 'active',
  INJURED = 'injured',
  SUSPENDED = 'suspended',
  DEAD = 'dead',
  RETIRED = 'retired'
}

export enum UserRole {
  COMMISSIONER = 'commissioner',
  ASST_COMMISSIONER = 'asst_commissioner',
  COACH = 'coach'
}

export enum TeamOwnershipRole {
  OWNER = 'owner',
  ASSISTANT_COACH = 'assistant_coach'
}

export enum MatchParticipantRole {
  COACH = 'coach',
  GUEST_COACH = 'guest_coach'
}
