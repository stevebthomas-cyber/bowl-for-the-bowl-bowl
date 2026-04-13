import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load roster data
const rostersPath = path.join(__dirname, '../../../database/rosters.json');
const ROSTERS = JSON.parse(fs.readFileSync(rostersPath, 'utf-8'));

// Remove the header "Name" entry
delete ROSTERS.Name;

export interface RosterPosition {
  minQty: number;
  maxQty: number;
  name: string;
  positionType: string;
  race: string;
  cost: number;
  movement: number;
  strength: number;
  agility: number;
  passing: number;
  armourValue: number;
  skills: string[];
  primarySkills: string[];
  secondarySkills: string[];
}

export interface TeamRoster {
  name: string;
  leagues: string[];
  specialRules: string[];
  minRerolls: number;
  maxRerolls: number;
  rerollCost: number;
  apothecary: boolean;
  positions: RosterPosition[];
}

export const DRAFT_BUDGET = 1000000;
export const ASSISTANT_COACH_COST = 10000;
export const CHEERLEADER_COST = 10000;
export const APOTHECARY_COST = 50000;
export const DEDICATED_FAN_COST = 5000;
export const MIN_PLAYERS = 11;
export const MAX_ASSISTANT_COACHES = 6;
export const MAX_CHEERLEADERS = 6;
export const MAX_DEDICATED_FANS = 3; // 1 free + 2 purchasable

/**
 * Get roster data for a specific race
 */
export function getRosterForRace(raceName: string): TeamRoster | null {
  return ROSTERS[raceName] || null;
}

/**
 * Get all available races
 */
export function getAllRaces(): string[] {
  return Object.keys(ROSTERS);
}

/**
 * Find a position in the roster by name
 */
export function findPosition(roster: TeamRoster, positionName: string): RosterPosition | null {
  // Filter out header rows
  const position = roster.positions.find(p =>
    p.name === positionName && p.name !== 'Position Name'
  );
  return position || null;
}

/**
 * Get the lineman position (for Journeymen)
 */
export function getLinemanPosition(roster: TeamRoster): RosterPosition | null {
  // Find position with positionType === 'Lineman'
  const lineman = roster.positions.find(p =>
    p.positionType === 'Lineman' && p.name !== 'Position Name'
  );
  return lineman || null;
}

/**
 * Validate if a position can be added to the roster
 */
export function canAddPosition(
  roster: TeamRoster,
  positionName: string,
  currentCounts: Record<string, number>
): { valid: boolean; reason?: string; position?: RosterPosition } {
  const position = findPosition(roster, positionName);

  if (!position) {
    return { valid: false, reason: `Position "${positionName}" not found in ${roster.name} roster` };
  }

  const currentCount = currentCounts[positionName] || 0;

  if (currentCount >= position.maxQty) {
    return {
      valid: false,
      reason: `Maximum ${position.maxQty} ${positionName}(s) allowed, you already have ${currentCount}`
    };
  }

  return { valid: true, position };
}

/**
 * Calculate current team spending
 */
export function calculateTeamSpending(teamData: {
  players: Array<{ player_value: number }>;
  rerolls: number;
  rerollCost: number;
  assistantCoaches: number;
  cheerleaders: number;
  hasApothecary: boolean;
  dedicatedFans: number;
}): {
  playerCosts: number;
  rerollCosts: number;
  staffCosts: number;
  fanCosts: number;
  totalSpent: number;
  treasury: number;
} {
  const playerCosts = teamData.players.reduce((sum, p) => sum + p.player_value, 0);
  const rerollCosts = teamData.rerolls * teamData.rerollCost;

  let staffCosts = 0;
  staffCosts += teamData.assistantCoaches * ASSISTANT_COACH_COST;
  staffCosts += teamData.cheerleaders * CHEERLEADER_COST;
  if (teamData.hasApothecary) staffCosts += APOTHECARY_COST;

  // Only purchased fans count (subtract the 1 free fan)
  const purchasedFans = Math.max(0, teamData.dedicatedFans - 1);
  const fanCosts = purchasedFans * DEDICATED_FAN_COST;

  const totalSpent = playerCosts + rerollCosts + staffCosts + fanCosts;
  const treasury = DRAFT_BUDGET - totalSpent;

  return {
    playerCosts,
    rerollCosts,
    staffCosts,
    fanCosts,
    totalSpent,
    treasury
  };
}

/**
 * Calculate Current Team Value (CTV)
 */
export function calculateTeamValue(teamData: {
  players: Array<{ player_value: number }>;
  rerolls: number;
  rerollCost: number;
  assistantCoaches: number;
  cheerleaders: number;
  hasApothecary: boolean;
  dedicatedFans: number;
}): number {
  const spending = calculateTeamSpending(teamData);
  // CTV = everything spent (which includes purchased fans)
  return spending.totalSpent;
}

/**
 * Validate jersey number uniqueness
 */
export function isJerseyNumberAvailable(
  usedNumbers: number[],
  requestedNumber: number
): boolean {
  return !usedNumbers.includes(requestedNumber);
}

/**
 * Calculate how many Journeymen are needed
 */
export function calculateJourneymenNeeded(currentPlayerCount: number): number {
  if (currentPlayerCount >= MIN_PLAYERS) {
    return 0;
  }
  return MIN_PLAYERS - currentPlayerCount;
}

/**
 * Validate reroll purchase
 */
export function validateRerollPurchase(
  roster: TeamRoster,
  currentRerolls: number,
  requestedRerolls: number,
  treasury: number
): { valid: boolean; reason?: string; cost?: number } {
  const totalRerolls = currentRerolls + requestedRerolls;

  if (totalRerolls > roster.maxRerolls) {
    return {
      valid: false,
      reason: `Maximum ${roster.maxRerolls} rerolls allowed, you would have ${totalRerolls}`
    };
  }

  const cost = requestedRerolls * roster.rerollCost;
  if (cost > treasury) {
    return {
      valid: false,
      reason: `Not enough gold. Cost: ${cost.toLocaleString()}, Treasury: ${treasury.toLocaleString()}`
    };
  }

  return { valid: true, cost };
}

/**
 * Validate staff purchase
 */
export function validateStaffPurchase(
  staffType: 'assistant_coach' | 'cheerleader' | 'apothecary',
  currentCount: number,
  requestedCount: number,
  treasury: number,
  teamHasApothecary: boolean // from roster rules
): { valid: boolean; reason?: string; cost?: number } {
  let maxAllowed = 0;
  let costPer = 0;
  let staffName = '';

  switch (staffType) {
    case 'assistant_coach':
      maxAllowed = MAX_ASSISTANT_COACHES;
      costPer = ASSISTANT_COACH_COST;
      staffName = 'Assistant Coach';
      break;
    case 'cheerleader':
      maxAllowed = MAX_CHEERLEADERS;
      costPer = CHEERLEADER_COST;
      staffName = 'Cheerleader';
      break;
    case 'apothecary':
      if (!teamHasApothecary) {
        return { valid: false, reason: 'Your team cannot hire an Apothecary' };
      }
      maxAllowed = 1;
      costPer = APOTHECARY_COST;
      staffName = 'Apothecary';
      break;
  }

  const totalCount = currentCount + requestedCount;
  if (totalCount > maxAllowed) {
    return {
      valid: false,
      reason: `Maximum ${maxAllowed} ${staffName}${maxAllowed > 1 ? 's' : ''} allowed`
    };
  }

  const cost = requestedCount * costPer;
  if (cost > treasury) {
    return {
      valid: false,
      reason: `Not enough gold. Cost: ${cost.toLocaleString()}, Treasury: ${treasury.toLocaleString()}`
    };
  }

  return { valid: true, cost };
}
