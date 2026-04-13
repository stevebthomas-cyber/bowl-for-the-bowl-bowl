/**
 * Shared Roster Management Functions
 *
 * These functions handle all player-related operations and can be called from:
 * - Web UI (roster page, wizards)
 * - Discord bot commands
 * - Pre/Post-game workflows
 *
 * All functions validate inputs, update database, handle treasury/value calculations,
 * and return consistent success/error responses.
 */

import { supabase } from '../config/supabase';

export interface RosterManagementResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Hire a new player for a team
 * Validates position limits, treasury, and roster size
 */
export async function hirePlayer(
  teamId: string,
  positionId: string,
  playerName: string,
  jerseyNumber: number
): Promise<RosterManagementResult> {
  try {
    // Get team info and validate
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, race, treasury, league_id, leagues!teams_league_id_fkey(season_number)')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return { success: false, message: 'Team not found', error: teamError?.message };
    }

    // Get position details
    const { data: position, error: posError } = await supabase
      .from('roster_positions')
      .select('*')
      .eq('id', positionId)
      .single();

    if (posError || !position) {
      return { success: false, message: 'Position not found', error: posError?.message };
    }

    // Check treasury
    if (team.treasury < position.cost) {
      return { success: false, message: `Insufficient treasury. Need ${position.cost}g, have ${team.treasury}g` };
    }

    // Check roster size (max 16 players)
    const { count: playerCount } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'active');

    if ((playerCount || 0) >= 16) {
      return { success: false, message: 'Roster is full (16 players maximum)' };
    }

    // Check position quantity limit
    const { count: positionCount } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('position', position.position_name)
      .eq('status', 'active');

    if ((positionCount || 0) >= position.max_quantity) {
      return { success: false, message: `Maximum ${position.max_quantity} ${position.position_name}(s) allowed` };
    }

    // Check jersey number uniqueness
    const { count: numberCount } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('number', jerseyNumber);

    if ((numberCount || 0) > 0) {
      return { success: false, message: `Jersey number ${jerseyNumber} is already in use` };
    }

    const seasonNumber = (team.leagues as any)?.season_number || 1;

    // Insert player
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({
        team_id: teamId,
        name: playerName.trim(),
        number: jerseyNumber,
        position: position.position_name,
        movement: position.ma,
        strength: position.st,
        agility: position.ag,
        passing: position.pa,
        armor_value: position.av,
        skills: position.skills || [],
        player_value: position.cost,
        season_joined: seasonNumber,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      return { success: false, message: 'Failed to create player', error: insertError.message };
    }

    // Deduct from treasury
    const { error: treasuryError } = await supabase.rpc('decrement_treasury', {
      p_team_id: teamId,
      p_amount: position.cost
    });

    if (treasuryError) {
      // Rollback: delete the player
      await supabase.from('players').delete().eq('id', newPlayer.id);
      return { success: false, message: 'Failed to update treasury', error: treasuryError.message };
    }

    return {
      success: true,
      message: `${playerName} hired successfully for ${position.cost}g`,
      data: newPlayer
    };
  } catch (err) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Fire a player from the team
 * Player is marked as 'retired' and removed from active roster
 */
export async function firePlayer(playerId: string): Promise<RosterManagementResult> {
  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, name, status')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return { success: false, message: 'Player not found', error: playerError?.message };
    }

    if (player.status !== 'active') {
      return { success: false, message: 'Player is not active' };
    }

    // Mark as retired (soft delete)
    const { error: updateError } = await supabase
      .from('players')
      .update({ status: 'retired' })
      .eq('id', playerId);

    if (updateError) {
      return { success: false, message: 'Failed to retire player', error: updateError.message };
    }

    return {
      success: true,
      message: `${player.name} has been fired`,
      data: player
    };
  } catch (err) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Temporarily retire a player (injured reserve, etc.)
 */
export async function retirePlayerTemporarily(playerId: string): Promise<RosterManagementResult> {
  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, name, status')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return { success: false, message: 'Player not found', error: playerError?.message };
    }

    const { error: updateError } = await supabase
      .from('players')
      .update({ status: 'injured_reserve' })
      .eq('id', playerId);

    if (updateError) {
      return { success: false, message: 'Failed to update player status', error: updateError.message };
    }

    return {
      success: true,
      message: `${player.name} moved to injured reserve`,
      data: player
    };
  } catch (err) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Update player name and/or jersey number
 */
export async function updatePlayerDetails(
  playerId: string,
  updates: { name?: string; number?: number }
): Promise<RosterManagementResult> {
  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, name, number, team_id')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return { success: false, message: 'Player not found', error: playerError?.message };
    }

    // Check jersey number uniqueness if changing
    if (updates.number && updates.number !== player.number) {
      const { count } = await supabase
        .from('players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', player.team_id)
        .eq('number', updates.number)
        .neq('id', playerId);

      if ((count || 0) > 0) {
        return { success: false, message: `Jersey number ${updates.number} is already in use` };
      }
    }

    const updateData: any = {};
    if (updates.name) updateData.name = updates.name.trim();
    if (updates.number) updateData.number = updates.number;

    const { error: updateError } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId);

    if (updateError) {
      return { success: false, message: 'Failed to update player', error: updateError.message };
    }

    return {
      success: true,
      message: 'Player updated successfully',
      data: { ...player, ...updateData }
    };
  } catch (err) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Set or clear miss next game flag
 */
export async function setMissNextGame(
  playerId: string,
  missNextGame: boolean
): Promise<RosterManagementResult> {
  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, name')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return { success: false, message: 'Player not found', error: playerError?.message };
    }

    const { error: updateError } = await supabase
      .from('players')
      .update({ miss_next_game: missNextGame })
      .eq('id', playerId);

    if (updateError) {
      return { success: false, message: 'Failed to update player', error: updateError.message };
    }

    return {
      success: true,
      message: missNextGame
        ? `${player.name} will miss next game`
        : `${player.name} is available for next game`,
      data: player
    };
  } catch (err) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Award SPP to a player and update stats
 */
export async function awardSPP(
  playerId: string,
  sppToAdd: number,
  statUpdates?: {
    touchdowns?: number;
    completions?: number;
    interceptions?: number;
    casualties?: number;
    mvp_awards?: number;
  }
): Promise<RosterManagementResult> {
  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return { success: false, message: 'Player not found', error: playerError?.message };
    }

    const updateData: any = {
      spp: (player.spp || 0) + sppToAdd
    };

    if (statUpdates) {
      if (statUpdates.touchdowns) updateData.touchdowns = (player.touchdowns || 0) + statUpdates.touchdowns;
      if (statUpdates.completions) updateData.completions = (player.completions || 0) + statUpdates.completions;
      if (statUpdates.interceptions) updateData.interceptions = (player.interceptions || 0) + statUpdates.interceptions;
      if (statUpdates.casualties) updateData.casualties = (player.casualties || 0) + statUpdates.casualties;
      if (statUpdates.mvp_awards) updateData.mvp_awards = (player.mvp_awards || 0) + statUpdates.mvp_awards;
    }

    const { error: updateError } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId);

    if (updateError) {
      return { success: false, message: 'Failed to award SPP', error: updateError.message };
    }

    return {
      success: true,
      message: `Awarded ${sppToAdd} SPP to ${player.name}`,
      data: { ...player, ...updateData }
    };
  } catch (err) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Calculate player level based on SPP
 * Blood Bowl Season 3 levels:
 * - Rookie: 0-5 SPP
 * - Experienced: 6-15 SPP
 * - Veteran: 16-30 SPP
 * - Emerging Star: 31-50 SPP
 * - Star: 51-75 SPP
 * - Super Star: 76-175 SPP
 * - Legend: 176+ SPP
 */
export function calculatePlayerLevel(spp: number): string {
  if (spp >= 176) return 'Legend';
  if (spp >= 76) return 'Super Star';
  if (spp >= 51) return 'Star';
  if (spp >= 31) return 'Emerging Star';
  if (spp >= 16) return 'Veteran';
  if (spp >= 6) return 'Experienced';
  return 'Rookie';
}

/**
 * Calculate current player value
 * Base cost + advancement costs
 */
export function calculatePlayerValue(
  baseCost: number,
  advancements: {
    skillsAdded?: number;
    statIncreases?: number;
  }
): number {
  let totalValue = baseCost;

  // Each normal skill costs 20k, each double skill costs 30k
  // For simplicity, we'll assume all skills are normal (can be enhanced later)
  if (advancements.skillsAdded) {
    totalValue += advancements.skillsAdded * 20000;
  }

  // Stat increases cost 20k each
  if (advancements.statIncreases) {
    totalValue += advancements.statIncreases * 20000;
  }

  return totalValue;
}

/**
 * Hire a journeyman for a team (temporary player for under-strength teams)
 * Journeymen are free and automatically added when roster < 11 players
 */
export async function hireJourneyman(
  teamId: string,
  positionId: string,
  jerseyNumber: number
): Promise<RosterManagementResult> {
  try {
    // Get team info
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, race, league_id, leagues!teams_league_id_fkey(season_number)')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return { success: false, message: 'Team not found', error: teamError?.message };
    }

    // Get position details
    const { data: position, error: posError } = await supabase
      .from('roster_positions')
      .select('*')
      .eq('id', positionId)
      .single();

    if (posError || !position) {
      return { success: false, message: 'Position not found', error: posError?.message };
    }

    // Count active players (not journeymen)
    const { count: playerCount } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId)
      .eq('status', 'active')
      .eq('is_journeyman', false);

    if ((playerCount || 0) >= 11) {
      return { success: false, message: 'Team has 11+ players, journeymen not needed' };
    }

    const seasonNumber = (team.leagues as any)?.season_number || 1;

    // Insert journeyman (free, temporary)
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({
        team_id: teamId,
        name: `Journeyman ${position.position_name}`,
        number: jerseyNumber,
        position: position.position_name,
        movement: position.ma,
        strength: position.st,
        agility: position.ag,
        passing: position.pa,
        armor_value: position.av,
        skills: position.skills || [],
        player_value: 0, // Journeymen have no value
        season_joined: seasonNumber,
        status: 'active',
        is_journeyman: true,
      })
      .select()
      .single();

    if (insertError) {
      return { success: false, message: 'Failed to hire journeyman', error: insertError.message };
    }

    return {
      success: true,
      message: `Journeyman ${position.position_name} hired (free)`,
      data: newPlayer
    };
  } catch (err) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Apply injury to a player
 * Tracks injury type and applies permanent stat damage if applicable
 */
export async function applyInjury(
  playerId: string,
  injuryType: string,
  statDamage?: {
    movement?: number;
    strength?: number;
    agility?: number;
    armor_value?: number;
  }
): Promise<RosterManagementResult> {
  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return { success: false, message: 'Player not found', error: playerError?.message };
    }

    const updateData: any = {
      injury_type: injuryType,
    };

    // Apply permanent stat damage
    if (statDamage) {
      if (statDamage.movement) {
        updateData.movement = Math.max(1, player.movement - statDamage.movement);
      }
      if (statDamage.strength) {
        updateData.strength = Math.max(1, player.strength - statDamage.strength);
      }
      if (statDamage.agility) {
        updateData.agility = Math.min(6, player.agility + statDamage.agility); // Agility gets worse with higher numbers
      }
      if (statDamage.armor_value) {
        updateData.armor_value = Math.min(11, player.armor_value + statDamage.armor_value); // AV gets worse with higher numbers
      }
    }

    // Some injuries cause miss next game
    if (['Broken Jaw', 'Broken Ribs', 'Smashed Knee', 'Damaged Back'].includes(injuryType)) {
      updateData.miss_next_game = true;
    }

    // Dead or career-ending injuries
    if (['Dead', 'Smashed Hip', 'Smashed Knee', 'Broken Neck'].includes(injuryType)) {
      updateData.status = 'retired';
    }

    const { error: updateError } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId);

    if (updateError) {
      return { success: false, message: 'Failed to apply injury', error: updateError.message };
    }

    return {
      success: true,
      message: `${injuryType} injury applied to ${player.name}`,
      data: { ...player, ...updateData }
    };
  } catch (err) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Spend SPP to purchase advancements (skills or stat improvements)
 */
export async function spendSPPForAdvancement(
  playerId: string,
  advancementType: 'skill' | 'stat',
  advancement: {
    skillName?: string;
    statType?: 'movement' | 'strength' | 'agility' | 'armor_value';
    sppCost: number;
    goldfCost: number;
  }
): Promise<RosterManagementResult> {
  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return { success: false, message: 'Player not found', error: playerError?.message };
    }

    // Check if player has enough unspent SPP
    const unspentSPP = (player.spp || 0) - (player.spp_spent || 0);
    if (unspentSPP < advancement.sppCost) {
      return {
        success: false,
        message: `Insufficient SPP. Need ${advancement.sppCost}, have ${unspentSPP} unspent`
      };
    }

    // Get team treasury
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('treasury')
      .eq('id', player.team_id)
      .single();

    if (teamError || !team) {
      return { success: false, message: 'Team not found', error: teamError?.message };
    }

    if (team.treasury < advancement.goldfCost) {
      return {
        success: false,
        message: `Insufficient treasury. Need ${advancement.goldfCost}g, have ${team.treasury}g`
      };
    }

    const updateData: any = {
      spp_spent: (player.spp_spent || 0) + advancement.sppCost,
    };

    if (advancementType === 'skill' && advancement.skillName) {
      // Add skill to skills array
      const currentSkills = player.skills || [];
      updateData.skills = [...currentSkills, advancement.skillName];
      updateData.player_value = (player.player_value || 0) + advancement.goldfCost;
    } else if (advancementType === 'stat' && advancement.statType) {
      // Increase stat
      switch (advancement.statType) {
        case 'movement':
          updateData.movement = player.movement + 1;
          break;
        case 'strength':
          updateData.strength = player.strength + 1;
          break;
        case 'agility':
          updateData.agility = Math.max(1, player.agility - 1); // Agility improves by going down
          break;
        case 'armor_value':
          updateData.armor_value = Math.max(2, player.armor_value - 1); // AV improves by going down
          break;
      }
      updateData.player_value = (player.player_value || 0) + advancement.goldfCost;
    }

    // Update player
    const { error: updateError } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId);

    if (updateError) {
      return { success: false, message: 'Failed to apply advancement', error: updateError.message };
    }

    // Deduct gold cost from treasury
    if (advancement.goldfCost > 0) {
      const { error: treasuryError } = await supabase.rpc('decrement_treasury', {
        p_team_id: player.team_id,
        p_amount: advancement.goldfCost
      });

      if (treasuryError) {
        // Rollback player update
        await supabase.from('players').update(player).eq('id', playerId);
        return { success: false, message: 'Failed to update treasury', error: treasuryError.message };
      }
    }

    return {
      success: true,
      message: advancementType === 'skill'
        ? `${player.name} learned ${advancement.skillName}`
        : `${player.name} improved ${advancement.statType}`,
      data: { ...player, ...updateData }
    };
  } catch (err) {
    return {
      success: false,
      message: 'An unexpected error occurred',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
