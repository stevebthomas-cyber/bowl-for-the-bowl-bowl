/**
 * Inducement and Star Player utilities
 * Functions for filtering available inducements and star players based on team rules
 */

import { supabase } from '../config/supabase';
import { hasBriberyAndCorruption } from './team-calculations';

interface Inducement {
  id: string;
  name: string;
  type: string;
  base_cost: number;
  bribery_corruption_cost: number | null;
  max_quantity: number | null;
  description: string;
}

interface InducementWithCost extends Inducement {
  effective_cost: number;
}

interface StarPlayer {
  id: string;
  name: string;
  cost: number;
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
  skills: string[];
  special_rules: string[];
  plays_for: string;
  excluded_leagues: string[];
}

/**
 * Get all available inducements for a team
 * Applies Bribery & Corruption discount if team has that special rule
 * @param teamId - Team UUID
 * @returns Array of inducements with effective costs
 */
export async function getAvailableInducements(teamId: string): Promise<InducementWithCost[]> {
  // Fetch all inducements
  const { data: inducements, error } = await supabase
    .from('inducements')
    .select('*');

  if (error) throw new Error(`Failed to fetch inducements: ${error.message}`);

  // Check if team has Bribery and Corruption
  const hasBribery = await hasBriberyAndCorruption(teamId);

  // Map inducements with effective cost
  return (inducements || []).map(inducement => ({
    ...inducement,
    effective_cost: hasBribery && inducement.bribery_corruption_cost !== null
      ? inducement.bribery_corruption_cost
      : inducement.base_cost
  }));
}

/**
 * Get team's special rules league (e.g., Chaos Clash, Old World Classic)
 * @param teamId - Team UUID
 * @returns Special rules league name or null
 */
export async function getTeamSpecialRulesLeague(teamId: string): Promise<string | null> {
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('special_rules_league_id')
    .eq('id', teamId)
    .single();

  if (teamError) throw new Error(`Failed to fetch team: ${teamError.message}`);

  if (!team.special_rules_league_id) return null;

  const { data: league, error: leagueError } = await supabase
    .from('special_rules_leagues')
    .select('name')
    .eq('id', team.special_rules_league_id)
    .single();

  if (leagueError) throw new Error(`Failed to fetch special rules league: ${leagueError.message}`);

  return league.name;
}

/**
 * Get available star players for a team
 * Filters based on:
 * 1. plays_for: "Any Team" or includes team's race
 * 2. excluded_leagues: team's special rules league not in this list
 * @param teamId - Team UUID
 * @returns Array of available star players
 */
export async function getAvailableStarPlayers(teamId: string): Promise<StarPlayer[]> {
  // Get team's race
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('roster_template_id')
    .eq('id', teamId)
    .single();

  if (teamError) throw new Error(`Failed to fetch team: ${teamError.message}`);

  const { data: template, error: templateError } = await supabase
    .from('roster_templates')
    .select('team_name')
    .eq('id', team.roster_template_id)
    .single();

  if (templateError) throw new Error(`Failed to fetch roster template: ${templateError.message}`);

  const teamRace = template.team_name;

  // Get team's special rules league
  const specialRulesLeague = await getTeamSpecialRulesLeague(teamId);

  // Fetch all star players
  const { data: starPlayers, error: starPlayersError } = await supabase
    .from('star_players')
    .select('*');

  if (starPlayersError) throw new Error(`Failed to fetch star players: ${starPlayersError.message}`);

  // Filter star players
  return (starPlayers || []).filter(sp => {
    // Check plays_for
    const playsForAnyTeam = sp.plays_for.toLowerCase().includes('any team');
    const playsForThisRace = sp.plays_for.toLowerCase().includes(teamRace.toLowerCase());

    if (!playsForAnyTeam && !playsForThisRace) {
      return false;
    }

    // Check excluded_leagues
    if (specialRulesLeague && sp.excluded_leagues && sp.excluded_leagues.length > 0) {
      const isExcluded = sp.excluded_leagues.some(
        (league: string) => league.toLowerCase() === specialRulesLeague.toLowerCase()
      );
      if (isExcluded) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get cost of a specific inducement for a team (with Bribery & Corruption discount)
 * @param teamId - Team UUID
 * @param inducementId - Inducement UUID
 * @returns Effective cost
 */
export async function getInducementCost(teamId: string, inducementId: string): Promise<number> {
  const { data: inducement, error } = await supabase
    .from('inducements')
    .select('base_cost, bribery_corruption_cost')
    .eq('id', inducementId)
    .single();

  if (error) throw new Error(`Failed to fetch inducement: ${error.message}`);

  const hasBribery = await hasBriberyAndCorruption(teamId);

  return hasBribery && inducement.bribery_corruption_cost !== null
    ? inducement.bribery_corruption_cost
    : inducement.base_cost;
}
