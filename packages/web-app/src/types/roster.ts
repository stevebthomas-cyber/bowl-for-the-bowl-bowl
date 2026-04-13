// Roster template types for team creation

export interface RosterTemplate {
  id: string;
  team_name: string;
  tier_1: string | null;
  tier_2: string | null;
  special_rules: string[];
  min_rerolls: number;
  max_rerolls: number;
  reroll_cost: number;
  apothecary_allowed: boolean;
  apothecary_cost: number;
}

export interface RosterPosition {
  id: string;
  roster_template_id: string;
  min_quantity: number;
  max_quantity: number;
  position_name: string;
  position_type: string;
  race: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string[];
  primary_skills: string[];
  secondary_skills: string[];
}

// Team creation wizard state
export interface TeamCreationState {
  // Step 1: Choose race
  selectedRoster: RosterTemplate | null;

  // Step 2: Name team
  teamName: string;

  // Step 3: Buy players
  selectedPlayers: {
    positionId: string;
    quantity: number;
  }[];

  // Step 4: Buy rerolls and staff
  rerolls: number;
  apothecary: boolean;
  assistantCoaches: number;
  cheerleaders: number;
  dedicatedFans: number;

  // Budget tracking
  startingTreasury: number;
  spentOnPlayers: number;
  spentOnRerolls: number;
  spentOnStaff: number;
  remainingTreasury: number;
}

// Player purchase for team creation
export interface PlayerPurchase {
  position: RosterPosition;
  quantity: number;
}

// Constants
export const STAFF_COSTS = {
  APOTHECARY: 50000,
  ASSISTANT_COACH: 10000,
  CHEERLEADER: 10000,
  DEDICATED_FAN: 5000, // First is free, then 5k each
} as const;

export const STAFF_LIMITS = {
  MAX_ASSISTANT_COACHES: 6,
  MAX_CHEERLEADERS: 6,
  MAX_DEDICATED_FANS: 3, // Plus 1 free
  MIN_PLAYERS: 11,
  MAX_PLAYERS_STANDARD: 16,
} as const;
