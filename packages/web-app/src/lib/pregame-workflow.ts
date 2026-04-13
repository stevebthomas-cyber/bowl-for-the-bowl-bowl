/**
 * Pre-game workflow functions
 * Handle all pre-game setup including journeymen, CTV calculation, and inducements
 */

import { supabase } from '../config/supabase';
import { calculateCurrentTeamValue, calculatePettyCash } from './team-calculations';
import {
  canFieldElevenPlayers,
  calculateJourneymenNeeded,
  selectLinemanForJourneyman,
  getEligibleLinemanPositions
} from './journeyman-utils';
import { getAvailableInducements, getAvailableStarPlayers } from './inducement-utils';

interface JourneymanHireResult {
  success: boolean;
  playerId?: string;
  message: string;
  requiresChoice?: boolean;
  options?: any[];
}

/**
 * Auto-hire journeymen for a team that needs them
 * Automatically hires if only one lineman type exists
 * Returns options if multiple lineman types exist (coach must choose)
 * @param teamId - Team UUID
 * @param positionId - Optional specific position ID if coach has chosen
 * @returns Result object with success status and any options
 */
export async function autoHireJourneymen(
  teamId: string,
  positionId?: string
): Promise<JourneymanHireResult[]> {
  const journeymenNeeded = await calculateJourneymenNeeded(teamId);

  if (journeymenNeeded === 0) {
    return [{
      success: true,
      message: 'Team already has 11 players'
    }];
  }

  const results: JourneymanHireResult[] = [];

  // If positionId provided, use it for all journeymen
  if (positionId) {
    const { data: position, error: posError } = await supabase
      .from('roster_positions')
      .select('*')
      .eq('id', positionId)
      .single();

    if (posError) {
      return [{
        success: false,
        message: `Failed to fetch position: ${posError.message}`
      }];
    }

    // Hire the needed journeymen
    for (let i = 0; i < journeymenNeeded; i++) {
      const result = await hireJourneyman(teamId, position);
      results.push(result);
    }

    return results;
  }

  // No position specified - check if we can auto-select
  const linemanSelection = await selectLinemanForJourneyman(teamId);

  if (Array.isArray(linemanSelection)) {
    // Multiple lineman types - coach must choose
    return [{
      success: false,
      requiresChoice: true,
      message: `Coach must select lineman type (${journeymenNeeded} needed)`,
      options: linemanSelection
    }];
  }

  // Single lineman type - auto hire
  for (let i = 0; i < journeymenNeeded; i++) {
    const result = await hireJourneyman(teamId, linemanSelection);
    results.push(result);
  }

  return results;
}

/**
 * Hire a single journeyman
 * Journeymen have Loner (4+) trait and value of 0
 * @param teamId - Team UUID
 * @param position - Position data
 * @returns Result object
 */
async function hireJourneyman(teamId: string, position: any): Promise<JourneymanHireResult> {
  // Add Loner (4+) to skills if not present
  const skills = position.skills || [];
  if (!skills.some((s: string) => s.toLowerCase().includes('loner'))) {
    skills.push('Loner (4+)');
  }

  const { data: player, error } = await supabase
    .from('players')
    .insert({
      team_id: teamId,
      position_id: position.id,
      player_number: null, // Journeymen don't have permanent numbers
      player_name: `${position.position_name} (J)`,
      status: 'active',
      ma: position.ma,
      st: position.st,
      ag: position.ag,
      pa: position.pa,
      av: position.av,
      skills: skills,
      value: 0, // Journeymen have no value
      is_journeyman: true,
      spp: 0,
      spp_spent: 0,
      player_level: 'Rookie'
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      message: `Failed to hire journeyman: ${error.message}`
    };
  }

  return {
    success: true,
    playerId: player.id,
    message: `Hired journeyman ${position.position_name}`
  };
}

/**
 * Capture a pre-game snapshot for friendly games
 * Saves full team state (team data + all players) to revert after the game
 * @param gameId - Game UUID
 * @param teamId - Team UUID
 * @returns Snapshot ID
 */
export async function capturePreGameSnapshot(
  gameId: string,
  teamId: string
): Promise<string> {
  // Get team data
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (teamError) throw new Error(`Failed to fetch team: ${teamError.message}`);

  // Get all players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId);

  if (playersError) throw new Error(`Failed to fetch players: ${playersError.message}`);

  // Create snapshot
  const snapshotData = {
    team,
    players
  };

  const { data: snapshot, error: snapshotError } = await supabase
    .from('game_snapshots')
    .insert({
      game_id: gameId,
      team_id: teamId,
      snapshot_data: snapshotData
    })
    .select()
    .single();

  if (snapshotError) throw new Error(`Failed to create snapshot: ${snapshotError.message}`);

  return snapshot.id;
}

/**
 * Check pre-game eligibility and requirements
 * @param teamId - Team UUID
 * @returns Object with eligibility status and required actions
 */
export async function checkPreGameEligibility(teamId: string): Promise<{
  eligible: boolean;
  currentTeamValue: number;
  availablePlayers: number;
  journeymenNeeded: number;
  requiresJourneymanChoice: boolean;
  linemanOptions?: any[];
}> {
  const { canField, availableCount } = await canFieldElevenPlayers(teamId);
  const journeymenNeeded = await calculateJourneymenNeeded(teamId);
  const ctv = await calculateCurrentTeamValue(teamId);

  let requiresJourneymanChoice = false;
  let linemanOptions;

  if (journeymenNeeded > 0) {
    const linemanSelection = await selectLinemanForJourneyman(teamId);
    if (Array.isArray(linemanSelection)) {
      requiresJourneymanChoice = true;
      linemanOptions = linemanSelection;
    }
  }

  return {
    eligible: canField || journeymenNeeded > 0,
    currentTeamValue: ctv,
    availablePlayers: availableCount,
    journeymenNeeded,
    requiresJourneymanChoice,
    linemanOptions
  };
}

/**
 * Get complete pre-game information for both teams
 * @param homeTeamId - Home team UUID
 * @param awayTeamId - Away team UUID
 * @returns Complete pre-game data
 */
export async function getPreGameInfo(homeTeamId: string, awayTeamId: string): Promise<{
  homeTeam: any;
  awayTeam: any;
  pettyCash: any;
  availableInducements: {
    home: any[];
    away: any[];
  };
  availableStarPlayers: {
    home: any[];
    away: any[];
  };
}> {
  const [homeEligibility, awayEligibility, pettyCash] = await Promise.all([
    checkPreGameEligibility(homeTeamId),
    checkPreGameEligibility(awayTeamId),
    calculatePettyCash(homeTeamId, awayTeamId)
  ]);

  const [homeInducements, awayInducements, homeStarPlayers, awayStarPlayers] = await Promise.all([
    getAvailableInducements(homeTeamId),
    getAvailableInducements(awayTeamId),
    getAvailableStarPlayers(homeTeamId),
    getAvailableStarPlayers(awayTeamId)
  ]);

  return {
    homeTeam: homeEligibility,
    awayTeam: awayEligibility,
    pettyCash,
    availableInducements: {
      home: homeInducements,
      away: awayInducements
    },
    availableStarPlayers: {
      home: homeStarPlayers,
      away: awayStarPlayers
    }
  };
}
