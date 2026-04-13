/**
 * Journeyman hiring utilities
 * Functions for identifying eligible lineman positions and hiring journeymen
 */

import { supabase } from '../config/supabase';

interface LinemanPosition {
  id: string;
  position_name: string;
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

/**
 * Get all lineman positions for a team's roster
 * Linemen are identified by having "Lineman" or "Linemen" in position_name
 * @param teamId - Team UUID
 * @returns Array of lineman positions
 */
export async function getEligibleLinemanPositions(teamId: string): Promise<LinemanPosition[]> {
  // Get team's roster template
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('roster_template_id')
    .eq('id', teamId)
    .single();

  if (teamError) throw new Error(`Failed to fetch team: ${teamError.message}`);

  // Get roster template team_name (which corresponds to race in roster_positions)
  const { data: template, error: templateError } = await supabase
    .from('roster_templates')
    .select('team_name')
    .eq('id', team.roster_template_id)
    .single();

  if (templateError) throw new Error(`Failed to fetch roster template: ${templateError.message}`);

  // Get all positions for this race that are linemen
  const { data: positions, error: positionsError } = await supabase
    .from('roster_positions')
    .select('*')
    .eq('race', template.team_name)
    .or('position_name.ilike.%lineman%,position_name.ilike.%linemen%');

  if (positionsError) throw new Error(`Failed to fetch lineman positions: ${positionsError.message}`);

  return positions || [];
}

/**
 * Select lineman position for journeyman hiring
 * If only one lineman type exists, return it
 * If multiple exist, this requires coach's choice (return all options)
 * @param teamId - Team UUID
 * @returns Single position if only one option, or array of options if multiple
 */
export async function selectLinemanForJourneyman(
  teamId: string
): Promise<LinemanPosition | LinemanPosition[]> {
  const linemanPositions = await getEligibleLinemanPositions(teamId);

  if (linemanPositions.length === 0) {
    throw new Error('No lineman positions found for this team');
  }

  if (linemanPositions.length === 1) {
    return linemanPositions[0];
  }

  // Multiple options - coach must choose
  return linemanPositions;
}

/**
 * Check if team can field 11 players
 * Counts active players that are not missing next game
 * @param teamId - Team UUID
 * @returns Object with canField boolean and available player count
 */
export async function canFieldElevenPlayers(
  teamId: string
): Promise<{ canField: boolean; availableCount: number }> {
  const { data: players, error } = await supabase
    .from('players')
    .select('id')
    .eq('team_id', teamId)
    .eq('miss_next_game', false)
    .in('status', ['active', 'injured']);

  if (error) throw new Error(`Failed to count available players: ${error.message}`);

  const availableCount = players?.length || 0;

  return {
    canField: availableCount >= 11,
    availableCount
  };
}

/**
 * Calculate how many journeymen are needed
 * @param teamId - Team UUID
 * @returns Number of journeymen needed (0 if team has 11+)
 */
export async function calculateJourneymenNeeded(teamId: string): Promise<number> {
  const { availableCount } = await canFieldElevenPlayers(teamId);
  return Math.max(0, 11 - availableCount);
}
