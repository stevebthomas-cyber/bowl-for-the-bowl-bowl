/**
 * Game Workflow Functions
 *
 * Small, discrete functions for pre-game and post-game workflows.
 * Each function handles ONE specific task and can be composed together.
 * Can be called from: Web UI wizards, Discord bot commands
 */

import { supabase } from '../config/supabase';

export interface WorkflowResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * PRE-GAME FUNCTIONS
 */

/**
 * Check if team needs journeymen (< 11 active players)
 */
export async function checkNeedsJourneymen(teamId: string): Promise<{
  needed: boolean;
  currentCount: number;
  journeymenNeeded: number;
}> {
  const { count } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('status', 'active')
    .eq('is_journeyman', false);

  const currentCount = count || 0;
  const journeymenNeeded = Math.max(0, 11 - currentCount);

  return {
    needed: journeymenNeeded > 0,
    currentCount,
    journeymenNeeded
  };
}

/**
 * Get available inducements for a team
 */
export async function getAvailableInducements(teamId: string): Promise<WorkflowResult> {
  try {
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('treasury, current_team_value')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return { success: false, message: 'Team not found', error: teamError?.message };
    }

    // Return treasury available for inducements
    return {
      success: true,
      message: 'Treasury retrieved',
      data: {
        availableTreasury: team.treasury || 0,
        teamValue: team.current_team_value || 0
      }
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to get inducements',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Purchase an inducement (Star Player, Merc, Special Card, etc.)
 */
export async function purchaseInducement(
  teamId: string,
  inducement: {
    type: 'star_player' | 'mercenary' | 'card' | 'reroll' | 'apothecary' | 'assistant_coach' | 'cheerleader';
    name: string;
    cost: number;
    temporary: boolean; // true for one-game inducements
  }
): Promise<WorkflowResult> {
  try {
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('treasury')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return { success: false, message: 'Team not found', error: teamError?.message };
    }

    if (team.treasury < inducement.cost) {
      return {
        success: false,
        message: `Insufficient treasury. Need ${inducement.cost}g, have ${team.treasury}g`
      };
    }

    // Deduct cost from treasury
    const { error: treasuryError } = await supabase.rpc('decrement_treasury', {
      p_team_id: teamId,
      p_amount: inducement.cost
    });

    if (treasuryError) {
      return { success: false, message: 'Failed to update treasury', error: treasuryError.message };
    }

    // Record inducement purchase
    // TODO: Track inducements in database table

    return {
      success: true,
      message: `Purchased ${inducement.name} for ${inducement.cost}g`,
      data: { inducement }
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to purchase inducement',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Validate team can play (min 11 players including journeymen)
 */
export async function validateTeamForGame(teamId: string): Promise<WorkflowResult> {
  try {
    const { count } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'active')
      .eq('miss_next_game', false);

    const availablePlayers = count || 0;

    if (availablePlayers < 11) {
      return {
        success: false,
        message: `Team needs at least 11 available players to play. Currently have ${availablePlayers}`
      };
    }

    return {
      success: true,
      message: 'Team is valid for game',
      data: { availablePlayers }
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to validate team',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * POST-GAME FUNCTIONS
 */

/**
 * Award game winnings to team treasury
 */
export async function awardWinnings(
  teamId: string,
  amount: number
): Promise<WorkflowResult> {
  try {
    const { data: team, error } = await supabase
      .from('teams')
      .select('treasury')
      .eq('id', teamId)
      .single();

    if (error || !team) {
      return { success: false, message: 'Team not found', error: error?.message };
    }

    const { error: updateError } = await supabase
      .from('teams')
      .update({ treasury: team.treasury + amount })
      .eq('id', teamId);

    if (updateError) {
      return { success: false, message: 'Failed to award winnings', error: updateError.message };
    }

    return {
      success: true,
      message: `Awarded ${amount}g to team treasury`,
      data: { newTreasury: team.treasury + amount }
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to award winnings',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Update fan factor after a game
 */
export async function updateFanFactor(
  teamId: string,
  change: number
): Promise<WorkflowResult> {
  try {
    const { data: team, error } = await supabase
      .from('teams')
      .select('fan_factor')
      .eq('id', teamId)
      .single();

    if (error || !team) {
      return { success: false, message: 'Team not found', error: error?.message };
    }

    const newFanFactor = Math.max(1, Math.min(6, (team.fan_factor || 1) + change));

    const { error: updateError } = await supabase
      .from('teams')
      .update({ fan_factor: newFanFactor })
      .eq('id', teamId);

    if (updateError) {
      return { success: false, message: 'Failed to update fan factor', error: updateError.message };
    }

    return {
      success: true,
      message: `Fan factor ${change > 0 ? 'increased' : 'decreased'} to ${newFanFactor}`,
      data: { fanFactor: newFanFactor }
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to update fan factor',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Remove journeymen from roster after game
 */
export async function removeJourneymen(teamId: string): Promise<WorkflowResult> {
  try {
    const { data: journeymen, error: queryError } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', teamId)
      .eq('is_journeyman', true)
      .eq('status', 'active');

    if (queryError) {
      return { success: false, message: 'Failed to query journeymen', error: queryError.message };
    }

    if (!journeymen || journeymen.length === 0) {
      return { success: true, message: 'No journeymen to remove', data: { removed: 0 } };
    }

    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('team_id', teamId)
      .eq('is_journeyman', true)
      .eq('status', 'active');

    if (deleteError) {
      return { success: false, message: 'Failed to remove journeymen', error: deleteError.message };
    }

    return {
      success: true,
      message: `Removed ${journeymen.length} journeyman player(s)`,
      data: { removed: journeymen.length }
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to remove journeymen',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Clear "miss next game" flags for all players
 */
export async function clearMissNextGameFlags(teamId: string): Promise<WorkflowResult> {
  try {
    const { data: players, error: queryError } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', teamId)
      .eq('miss_next_game', true)
      .eq('status', 'active');

    if (queryError) {
      return { success: false, message: 'Failed to query players', error: queryError.message };
    }

    if (!players || players.length === 0) {
      return { success: true, message: 'No flags to clear', data: { cleared: 0 } };
    }

    const { error: updateError } = await supabase
      .from('players')
      .update({ miss_next_game: false })
      .eq('team_id', teamId)
      .eq('miss_next_game', true)
      .eq('status', 'active');

    if (updateError) {
      return { success: false, message: 'Failed to clear flags', error: updateError.message };
    }

    return {
      success: true,
      message: `Cleared miss next game flag for ${players.length} player(s)`,
      data: { cleared: players.length }
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to clear flags',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Update team record (wins/losses/draws)
 */
export async function updateTeamRecord(
  teamId: string,
  result: 'win' | 'loss' | 'draw'
): Promise<WorkflowResult> {
  try {
    const { data: team, error } = await supabase
      .from('teams')
      .select('wins, losses, draws')
      .eq('id', teamId)
      .single();

    if (error || !team) {
      return { success: false, message: 'Team not found', error: error?.message };
    }

    const updateData: any = {};
    if (result === 'win') updateData.wins = (team.wins || 0) + 1;
    if (result === 'loss') updateData.losses = (team.losses || 0) + 1;
    if (result === 'draw') updateData.draws = (team.draws || 0) + 1;

    const { error: updateError } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', teamId);

    if (updateError) {
      return { success: false, message: 'Failed to update record', error: updateError.message };
    }

    return {
      success: true,
      message: `Record updated: ${result}`,
      data: { ...team, ...updateData }
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to update record',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Calculate current team value (sum of all player values + staff costs)
 */
export async function calculateTeamValue(teamId: string): Promise<WorkflowResult> {
  try {
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('player_value')
      .eq('team_id', teamId)
      .eq('status', 'active')
      .eq('is_journeyman', false);

    if (playersError) {
      return { success: false, message: 'Failed to query players', error: playersError.message };
    }

    const playerValue = (players || []).reduce((sum, p) => sum + (p.player_value || 0), 0);

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('rerolls, assistant_coaches, cheerleaders, apothecary')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return { success: false, message: 'Team not found', error: teamError?.message };
    }

    // Staff costs (these are approximations, would need race-specific costs)
    const rerollCost = (team.rerolls || 0) * 50000; // Approximate
    const assistantCoachCost = (team.assistant_coaches || 0) * 10000;
    const cheerleaderCost = (team.cheerleaders || 0) * 10000;
    const apothecaryCost = team.apothecary ? 50000 : 0;

    const totalValue = playerValue + rerollCost + assistantCoachCost + cheerleaderCost + apothecaryCost;

    // Update team's current_team_value
    const { error: updateError } = await supabase
      .from('teams')
      .update({ current_team_value: totalValue })
      .eq('id', teamId);

    if (updateError) {
      return { success: false, message: 'Failed to update team value', error: updateError.message };
    }

    return {
      success: true,
      message: 'Team value calculated',
      data: { teamValue: totalValue }
    };
  } catch (err) {
    return {
      success: false,
      message: 'Failed to calculate team value',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
