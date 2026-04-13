/**
 * Injury workflow functions
 * Handle casualty rolls, injury application, and Hatred trait assignment
 */

import { supabase } from '../config/supabase';

export type InjuryResult =
  | { type: 'none'; description: 'No lasting injury' }
  | { type: 'miss_next_game'; description: 'Miss Next Game' }
  | { type: 'niggling_injury'; description: 'Niggling Injury (+1 on Casualty Table) and Miss Next Game' }
  | { type: 'characteristic_reduction'; stat: string; description: string }
  | { type: 'dead'; description: 'Dead' };

export interface CasualtyRollResult {
  d16Roll: number;
  d6Roll?: number;
  injuryResult: InjuryResult;
  playerName: string;
  playerId: string;
  needsHatredInput: boolean;
}

/**
 * Roll for casualty (D16)
 * @returns Number 1-16
 */
export function rollD16(): number {
  // D16 = D8 + D8 (treating 1-4 as 0, 5-8 as 1 on first die)
  const d8_1 = Math.floor(Math.random() * 8) + 1;
  const d8_2 = Math.floor(Math.random() * 8) + 1;

  return d8_1 + d8_2;
}

/**
 * Roll for characteristic reduction (D6)
 * @returns Number 1-6
 */
export function rollD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Determine injury result from D16 roll
 * @param d16Roll - The D16 casualty roll
 * @param d6Roll - Optional D6 roll for characteristic reduction (13-14)
 * @returns Injury result object
 */
export function determineInjury(d16Roll: number, d6Roll?: number): InjuryResult {
  if (d16Roll >= 1 && d16Roll <= 8) {
    return {
      type: 'none',
      description: 'No lasting injury'
    };
  }

  if (d16Roll >= 9 && d16Roll <= 10) {
    return {
      type: 'miss_next_game',
      description: 'Miss Next Game'
    };
  }

  if (d16Roll >= 11 && d16Roll <= 12) {
    return {
      type: 'niggling_injury',
      description: 'Niggling Injury (+1 on Casualty Table) and Miss Next Game'
    };
  }

  if (d16Roll >= 13 && d16Roll <= 14) {
    // Characteristic reduction requires D6 roll
    if (!d6Roll) {
      throw new Error('D6 roll required for characteristic reduction');
    }

    let stat: string;
    let description: string;

    switch (d6Roll) {
      case 1:
      case 2:
        stat = 'av';
        description = 'Characteristic Reduction: -1 AV';
        break;
      case 3:
        stat = 'ma';
        description = 'Characteristic Reduction: -1 MA';
        break;
      case 4:
        stat = 'pa';
        description = 'Characteristic Reduction: +1 PA (worse)';
        break;
      case 5:
        stat = 'ag';
        description = 'Characteristic Reduction: +1 AG (worse)';
        break;
      case 6:
        stat = 'st';
        description = 'Characteristic Reduction: -1 ST';
        break;
      default:
        throw new Error('Invalid D6 roll');
    }

    return {
      type: 'characteristic_reduction',
      stat,
      description
    };
  }

  if (d16Roll >= 15 && d16Roll <= 16) {
    return {
      type: 'dead',
      description: 'Dead'
    };
  }

  throw new Error('Invalid D16 roll');
}

/**
 * Roll and apply casualty to a player (automated)
 * @param playerId - Player UUID
 * @param gameId - Optional game ID to record the casualty event
 * @returns Casualty result
 */
export async function rollAndApplyCasualty(
  playerId: string,
  gameId?: string
): Promise<CasualtyRollResult> {
  // Get player info
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('player_name, niggling_injuries')
    .eq('id', playerId)
    .single();

  if (playerError) throw new Error(`Failed to fetch player: ${playerError.message}`);

  // Roll D16
  let d16Roll = rollD16();

  // Add niggling injuries modifier
  if (player.niggling_injuries && player.niggling_injuries > 0) {
    d16Roll += player.niggling_injuries;
  }

  // Cap at 16
  d16Roll = Math.min(d16Roll, 16);

  // Roll D6 if needed for characteristic reduction
  let d6Roll: number | undefined;
  if (d16Roll >= 13 && d16Roll <= 14) {
    d6Roll = rollD6();
  }

  const injuryResult = determineInjury(d16Roll, d6Roll);

  // Apply the injury
  await applyInjury(playerId, injuryResult);

  return {
    d16Roll,
    d6Roll,
    injuryResult,
    playerName: player.player_name,
    playerId,
    needsHatredInput: true
  };
}

/**
 * Apply casualty manually (when coach rolls dice physically)
 * @param playerId - Player UUID
 * @param d16Roll - The D16 roll (already modified by niggling injuries if applicable)
 * @param d6Roll - The D6 roll for characteristic reduction (if applicable)
 * @returns Casualty result
 */
export async function applyManualCasualty(
  playerId: string,
  d16Roll: number,
  d6Roll?: number
): Promise<CasualtyRollResult> {
  // Get player info
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('player_name')
    .eq('id', playerId)
    .single();

  if (playerError) throw new Error(`Failed to fetch player: ${playerError.message}`);

  const injuryResult = determineInjury(d16Roll, d6Roll);

  // Apply the injury
  await applyInjury(playerId, injuryResult);

  return {
    d16Roll,
    d6Roll,
    injuryResult,
    playerName: player.player_name,
    playerId,
    needsHatredInput: true
  };
}

/**
 * Apply injury result to player
 * @param playerId - Player UUID
 * @param injuryResult - The injury result to apply
 */
export async function applyInjury(
  playerId: string,
  injuryResult: InjuryResult
): Promise<void> {
  const { data: player, error: fetchError } = await supabase
    .from('players')
    .select('ma, st, ag, pa, av, niggling_injuries, injuries, status')
    .eq('id', playerId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch player: ${fetchError.message}`);

  const updates: any = {};
  const injuries = player.injuries || [];

  switch (injuryResult.type) {
    case 'none':
      // No lasting injury - nothing to update
      break;

    case 'miss_next_game':
      updates.miss_next_game = true;
      injuries.push('Miss Next Game');
      break;

    case 'niggling_injury':
      updates.miss_next_game = true;
      updates.niggling_injuries = (player.niggling_injuries || 0) + 1;
      injuries.push('Niggling Injury');
      break;

    case 'characteristic_reduction':
      const stat = injuryResult.stat!;

      if (stat === 'av' || stat === 'ma' || stat === 'st') {
        // Decrement stat
        updates[stat] = player[stat] - 1;
      } else if (stat === 'pa' || stat === 'ag') {
        // Increment stat (worse)
        updates[stat] = player[stat] + 1;
      }

      updates.miss_next_game = true;
      injuries.push(injuryResult.description);
      break;

    case 'dead':
      updates.status = 'dead';
      updates.miss_next_game = true;
      injuries.push('Dead');
      break;
  }

  if (Object.keys(updates).length > 0) {
    updates.injuries = injuries;

    const { error: updateError } = await supabase
      .from('players')
      .update(updates)
      .eq('id', playerId);

    if (updateError) throw new Error(`Failed to apply injury: ${updateError.message}`);
  }
}

/**
 * Add Hatred trait to a player who suffered a casualty
 * @param playerId - Player UUID
 * @param hatredTarget - What the player hates (e.g., "Orcs", "Empire of Man", coach's choice)
 */
export async function addHatredTrait(
  playerId: string,
  hatredTarget: string
): Promise<void> {
  const { data: player, error: fetchError } = await supabase
    .from('players')
    .select('traits')
    .eq('id', playerId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch player: ${fetchError.message}`);

  const traits = player.traits || [];

  // Check if player already has Hatred
  const hasHatred = traits.some((t: string) =>
    t.toLowerCase().includes('hatred')
  );

  if (!hasHatred) {
    traits.push(`Hatred (${hatredTarget})`);

    const { error: updateError } = await supabase
      .from('players')
      .update({ traits })
      .eq('id', playerId);

    if (updateError) throw new Error(`Failed to add Hatred trait: ${updateError.message}`);
  }
}

/**
 * Process all casualties for a game
 * @param gameId - Game UUID
 * @param casualties - Array of casualty data with player IDs and optional manual rolls
 * @returns Array of casualty results
 */
export async function processGameCasualties(
  gameId: string,
  casualties: Array<{
    playerId: string;
    manualRoll?: { d16: number; d6?: number };
  }>
): Promise<CasualtyRollResult[]> {
  const results: CasualtyRollResult[] = [];

  for (const casualty of casualties) {
    let result: CasualtyRollResult;

    if (casualty.manualRoll) {
      result = await applyManualCasualty(
        casualty.playerId,
        casualty.manualRoll.d16,
        casualty.manualRoll.d6
      );
    } else {
      result = await rollAndApplyCasualty(casualty.playerId, gameId);
    }

    results.push(result);
  }

  return results;
}

/**
 * Get injury summary for a player
 * @param playerId - Player UUID
 * @returns Injury history and current status
 */
export async function getPlayerInjurySummary(playerId: string): Promise<{
  currentInjuries: string[];
  nigglingInjuries: number;
  missNextGame: boolean;
  isDead: boolean;
  hasHatred: boolean;
  hatredTarget?: string;
}> {
  const { data: player, error } = await supabase
    .from('players')
    .select('injuries, niggling_injuries, miss_next_game, status, traits')
    .eq('id', playerId)
    .single();

  if (error) throw new Error(`Failed to fetch player: ${error.message}`);

  const hatredTrait = (player.traits || []).find((t: string) =>
    t.toLowerCase().includes('hatred')
  );

  let hatredTarget: string | undefined;
  if (hatredTrait) {
    const match = hatredTrait.match(/hatred\s*\(([^)]+)\)/i);
    if (match) {
      hatredTarget = match[1];
    }
  }

  return {
    currentInjuries: player.injuries || [],
    nigglingInjuries: player.niggling_injuries || 0,
    missNextGame: player.miss_next_game || false,
    isDead: player.status === 'dead',
    hasHatred: !!hatredTrait,
    hatredTarget
  };
}
