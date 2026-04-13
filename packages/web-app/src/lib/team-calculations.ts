/**
 * Team value and financial calculations
 * These functions calculate various team values (TV, CTV) and financial metrics
 */

import { supabase } from '../config/supabase';

/**
 * Calculate total roster value (excludes dead and retired players)
 * @param teamId - Team UUID
 * @returns Total value of all active/injured players on the team
 */
export async function calculateRosterValue(teamId: string): Promise<number> {
  const { data: players, error } = await supabase
    .from('players')
    .select('player_value')
    .eq('team_id', teamId)
    .not('status', 'in', '(dead,retired)');

  if (error) throw new Error(`Failed to calculate roster value: ${error.message}`);

  return players?.reduce((sum, player) => sum + (player.player_value || 0), 0) || 0;
}

/**
 * Calculate staff value (rerolls, coaches, cheerleaders, apothecary)
 * @param teamId - Team UUID
 * @returns Total value of team staff
 */
export async function calculateStaffValue(teamId: string): Promise<number> {
  const { data: team, error } = await supabase
    .from('teams')
    .select('rerolls, race, dedicated_fans, assistant_coaches, cheerleaders, apothecary_hired')
    .eq('id', teamId)
    .single();

  if (error) throw new Error(`Failed to fetch team data: ${error.message}`);

  // Get roster template to find reroll cost
  const { data: rosterTemplate, error: rosterError } = await supabase
    .from('roster_templates')
    .select('reroll_cost')
    .eq('team_name', team.race)
    .single();

  if (rosterError) throw new Error(`Failed to fetch roster template: ${rosterError.message}`);

  const rerollValue = (team.rerolls || 0) * rosterTemplate.reroll_cost;
  const coachValue = (team.assistant_coaches || 0) * 10000;
  const cheerleaderValue = (team.cheerleaders || 0) * 10000;
  const apothecaryValue = team.apothecary_hired ? 50000 : 0;

  return rerollValue + coachValue + cheerleaderValue + apothecaryValue;
}

/**
 * Calculate Total Team Value (all players + staff)
 * @param teamId - Team UUID
 * @returns Total team value (roster + staff)
 */
export async function calculateTotalTeamValue(teamId: string): Promise<number> {
  const rosterValue = await calculateRosterValue(teamId);
  const staffValue = await calculateStaffValue(teamId);

  return rosterValue + staffValue;
}

/**
 * Calculate Current Team Value (excludes unavailable players)
 * Unavailable means: miss_next_game = true OR status IN ('dead', 'retired')
 * @param teamId - Team UUID
 * @returns Current team value (available roster + staff)
 */
export async function calculateCurrentTeamValue(teamId: string): Promise<number> {
  // Get available players only
  const { data: players, error } = await supabase
    .from('players')
    .select('player_value')
    .eq('team_id', teamId)
    .eq('miss_next_game', false)
    .in('status', ['active', 'injured']);

  if (error) throw new Error(`Failed to calculate CTV: ${error.message}`);

  const availableRosterValue = players?.reduce((sum, player) => sum + (player.player_value || 0), 0) || 0;
  const staffValue = await calculateStaffValue(teamId);

  return availableRosterValue + staffValue;
}

/**
 * Calculate petty cash between two teams
 * Formula: If CTV difference > 0, lower team gets (difference / 10000) in petty cash
 * @param homeTeamId - Home team UUID
 * @param awayTeamId - Away team UUID
 * @returns Object with pettyCash for each team and CTV values
 */
export async function calculatePettyCash(
  homeTeamId: string,
  awayTeamId: string
): Promise<{
  homeCTV: number;
  awayCTV: number;
  homePettyCash: number;
  awayPettyCash: number;
  ctvDifference: number;
}> {
  const homeCTV = await calculateCurrentTeamValue(homeTeamId);
  const awayCTV = await calculateCurrentTeamValue(awayTeamId);
  const ctvDifference = Math.abs(homeCTV - awayCTV);

  let homePettyCash = 0;
  let awayPettyCash = 0;

  if (homeCTV < awayCTV) {
    homePettyCash = Math.floor(ctvDifference / 10000);
  } else if (awayCTV < homeCTV) {
    awayPettyCash = Math.floor(ctvDifference / 10000);
  }

  return {
    homeCTV,
    awayCTV,
    homePettyCash,
    awayPettyCash,
    ctvDifference
  };
}

/**
 * Get team's special rules from roster template
 * @param teamId - Team UUID
 * @returns Array of special rule names
 */
export async function getTeamSpecialRules(teamId: string): Promise<string[]> {
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('roster_template_id')
    .eq('id', teamId)
    .single();

  if (teamError) throw new Error(`Failed to fetch team: ${teamError.message}`);

  const { data: template, error: templateError } = await supabase
    .from('roster_templates')
    .select('special_rules')
    .eq('id', team.roster_template_id)
    .single();

  if (templateError) throw new Error(`Failed to fetch roster template: ${templateError.message}`);

  // special_rules is a JSONB field that could be an object or array
  if (!template.special_rules) return [];

  if (Array.isArray(template.special_rules)) {
    return template.special_rules;
  }

  // If it's an object, return the keys (rule names)
  return Object.keys(template.special_rules);
}

/**
 * Check if team has Bribery and Corruption special rule
 * @param teamId - Team UUID
 * @returns True if team has Bribery and Corruption
 */
export async function hasBriberyAndCorruption(teamId: string): Promise<boolean> {
  const specialRules = await getTeamSpecialRules(teamId);
  return specialRules.some(rule =>
    rule.toLowerCase().includes('bribery') && rule.toLowerCase().includes('corruption')
  );
}

/**
 * Check if team has Brawlin' Brutes special rule
 * @param teamId - Team UUID
 * @returns True if team has Brawlin' Brutes
 */
export async function hasBrawlinBrutes(teamId: string): Promise<boolean> {
  const specialRules = await getTeamSpecialRules(teamId);
  return specialRules.some(rule =>
    rule.toLowerCase().includes('brawlin') && rule.toLowerCase().includes('brutes')
  );
}

/**
 * Get SPP value for touchdown based on team special rules
 * @param teamId - Team UUID
 * @returns SPP value (normally 3, but 2 if Brawlin' Brutes)
 */
export async function getSPPForTouchdown(teamId: string): Promise<number> {
  const hasBrawlin = await hasBrawlinBrutes(teamId);
  return hasBrawlin ? 2 : 3;
}

/**
 * Get SPP value for casualty based on team special rules
 * @param teamId - Team UUID
 * @returns SPP value (normally 2, but 3 if Brawlin' Brutes)
 */
export async function getSPPForCasualty(teamId: string): Promise<number> {
  const hasBrawlin = await hasBrawlinBrutes(teamId);
  return hasBrawlin ? 3 : 2;
}
