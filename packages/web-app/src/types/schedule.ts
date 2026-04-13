/**
 * Schedule Builder Type Definitions
 *
 * Core types for the schedule builder and management interface.
 */

export interface Team {
  id: string;
  name: string;
  division?: number;
}

export interface ScheduleConfig {
  // Schedule type
  scheduleType: 'round-robin' | 'divisional' | 'pool-only';

  // Divisional settings
  divisionsCount: number;
  teamsPerDivision: number;
  intraDivisionGames: number;
  interDivisionGames: number;

  // Round-robin settings
  targetGamesPerTeam: number;

  // Pool-only settings
  poolsCount: number;
  teamsPerPool: number;
  gamesPerTeamInPool: number;

  // Date/Time settings
  schedulingPeriod: 'weekly' | 'bi-weekly' | 'semi-weekly' | 'monthly' | 'custom';
  customDaysBetween: number; // For custom period
  gameDays: number[]; // Array of day indices 0-6 (Sun-Sat)
  gamesPerMeetup: number; // How many games when teams meet
  matchesPerDay: number; // How many matches can be played per day
  defaultGameTime: string; // HH:mm
  seasonStartDate: string; // ISO date
  seasonEndDate: string; // ISO date
  blackoutDates: string[]; // ISO dates

  // Playoff settings
  includePlayoffs: boolean;
  playoffFormat: 'none' | 'championship' | 'top_4' | 'play_in' | 'top_8' | 'division_winners';
}

export type MatchType = 'intra-division' | 'inter-division' | 'round-robin' | 'pool' | 'playoff';

export interface ScheduledMatch {
  matchNumber: number;
  homeSlot: string; // e.g., "D1-S1" (Division 1, Slot 1) or team ID if assigned
  homeTeamName?: string; // Only set if team is assigned
  awaySlot: string; // e.g., "D1-S2" or team ID if assigned
  awayTeamName?: string; // Only set if team is assigned
  scheduledDate: string; // ISO date
  weekNumber: number;
  matchType: MatchType;
  playoffRound?: string; // e.g., "Championship", "Semifinals", "Quarterfinals"
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  matchNumber?: number;
  matchNumbers?: number[];
}

// UI State Types

export enum ScheduleBuilderMode {
  EMPTY = 'empty',
  MANAGEMENT = 'management'
}

export type ViewMode = 'calendar' | 'table';

export type SortField =
  | 'matchNumber'
  | 'scheduledDate'
  | 'weekNumber'
  | 'matchType'
  | 'homeTeam'
  | 'awayTeam';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface FilterConfig {
  matchTypes: Set<MatchType>;
  weekNumbers: number[];
  dateRange: {
    start?: string;
    end?: string;
  };
  teams: Set<string>;
  hasUnassignedSlots: boolean | null;
}

// Week grouping for calendar view

export interface WeekGroup {
  weekNumber: number;
  startDate: string;
  matches: ScheduledMatch[];
}

// Save state tracking

export interface SaveState {
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  isSaving: boolean;
  saveError: string | null;
}
