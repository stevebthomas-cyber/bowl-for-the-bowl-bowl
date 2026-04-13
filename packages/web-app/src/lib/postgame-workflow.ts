/**
 * Post-game workflow functions
 * Handle all post-game processing including results, SPP, advancement, winnings
 */

import { supabase } from '../config/supabase';
import { getSPPForTouchdown, getSPPForCasualty } from './team-calculations';
import { processGameCasualties, CasualtyRollResult } from './injury-workflow';

/**
 * Record game result and determine winner
 * @param gameId - Game UUID
 * @param homeScore - Home team score
 * @param awayScore - Away team score
 * @param homeStalling - Whether home team was stalling
 * @param awayStalling - Whether away team was stalling
 */
export async function recordGameResult(
  gameId: string,
  homeScore: number,
  awayScore: number,
  homeStalling: boolean = false,
  awayStalling: boolean = false
): Promise<void> {
  let result: 'home_win' | 'away_win' | 'draw';

  if (homeScore > awayScore) {
    result = 'home_win';
  } else if (awayScore > homeScore) {
    result = 'away_win';
  } else {
    result = 'draw';
  }

  const { error } = await supabase
    .from('games')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      result,
      home_stalling: homeStalling,
      away_stalling: awayStalling,
      completed: true,
      completed_at: new Date().toISOString()
    })
    .eq('id', gameId);

  if (error) throw new Error(`Failed to record game result: ${error.message}`);
}

/**
 * Update dedicated fans based on game result
 * Formula: Roll D6 and modify based on result (+1 win, -1 loss, +1 if stalling)
 * @param teamId - Team UUID
 * @param gameId - Game UUID
 * @param won - Whether team won
 * @param drew - Whether game was a draw
 * @param stalling - Whether opposing team was stalling
 * @returns New dedicated fans value
 */
export async function updateDedicatedFans(
  teamId: string,
  gameId: string,
  won: boolean,
  drew: boolean,
  stalling: boolean
): Promise<number> {
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('dedicated_fans')
    .eq('id', teamId)
    .single();

  if (teamError) throw new Error(`Failed to fetch team: ${teamError.message}`);

  // Roll D6
  const d6 = Math.floor(Math.random() * 6) + 1;

  let modifier = 0;
  if (won) modifier += 1;
  if (!won && !drew) modifier -= 1; // Lost
  if (stalling) modifier += 1;

  const roll = d6 + modifier;

  let newFans = team.dedicated_fans;

  // Apply result based on table
  if (roll <= 1) {
    newFans -= 2;
  } else if (roll === 2) {
    newFans -= 1;
  } else if (roll >= 3 && roll <= 5) {
    // No change
  } else if (roll === 6) {
    newFans += 1;
  } else if (roll >= 7) {
    newFans += 2;
  }

  // Minimum of 1
  newFans = Math.max(1, newFans);

  const { error: updateError } = await supabase
    .from('teams')
    .update({ dedicated_fans: newFans })
    .eq('id', teamId);

  if (updateError) throw new Error(`Failed to update dedicated fans: ${updateError.message}`);

  return newFans;
}

/**
 * Record a touchdown event and award SPP
 * @param gameId - Game UUID
 * @param playerId - Player UUID
 * @param teamId - Team UUID
 */
export async function recordTouchdown(
  gameId: string,
  playerId: string,
  teamId: string
): Promise<void> {
  const spp = await getSPPForTouchdown(teamId);

  await recordGameEvent(gameId, playerId, teamId, 'touchdown', spp);
  await awardSPP(playerId, spp);
}

/**
 * Record a casualty event and award SPP
 * @param gameId - Game UUID
 * @param playerId - Player UUID
 * @param teamId - Team UUID
 */
export async function recordCasualty(
  gameId: string,
  playerId: string,
  teamId: string
): Promise<void> {
  const spp = await getSPPForCasualty(teamId);

  await recordGameEvent(gameId, playerId, teamId, 'casualty', spp);
  await awardSPP(playerId, spp);
}

/**
 * Record a completion event and award SPP
 * @param gameId - Game UUID
 * @param playerId - Player UUID
 * @param teamId - Team UUID
 */
export async function recordCompletion(
  gameId: string,
  playerId: string,
  teamId: string
): Promise<void> {
  await recordGameEvent(gameId, playerId, teamId, 'completion', 1);
  await awardSPP(playerId, 1);
}

/**
 * Record an interception event and award SPP
 * @param gameId - Game UUID
 * @param playerId - Player UUID
 * @param teamId - Team UUID
 */
export async function recordInterception(
  gameId: string,
  playerId: string,
  teamId: string
): Promise<void> {
  await recordGameEvent(gameId, playerId, teamId, 'interception', 2);
  await awardSPP(playerId, 2);
}

/**
 * Record a superb throw (Throw Team-mate) event and award SPP
 * @param gameId - Game UUID
 * @param playerId - Player UUID (thrower)
 * @param teamId - Team UUID
 */
export async function recordSuperbThrow(
  gameId: string,
  playerId: string,
  teamId: string
): Promise<void> {
  await recordGameEvent(gameId, playerId, teamId, 'superb_throw', 1);
  await awardSPP(playerId, 1);

  // Increment superb_throws counter
  const { error } = await supabase
    .from('players')
    .update({ superb_throws: supabase.rpc('increment') })
    .eq('id', playerId);

  if (error) throw new Error(`Failed to update superb throws: ${error.message}`);
}

/**
 * Record a successful landing (being thrown) event and award SPP
 * @param gameId - Game UUID
 * @param playerId - Player UUID (thrown player)
 * @param teamId - Team UUID
 */
export async function recordSuccessfulLanding(
  gameId: string,
  playerId: string,
  teamId: string
): Promise<void> {
  await recordGameEvent(gameId, playerId, teamId, 'successful_landing', 1);
  await awardSPP(playerId, 1);

  // Increment successful_landings counter
  const { error } = await supabase
    .from('players')
    .update({ successful_landings: supabase.rpc('increment') })
    .eq('id', playerId);

  if (error) throw new Error(`Failed to update successful landings: ${error.message}`);
}

/**
 * Record an MVP award and award SPP
 * @param gameId - Game UUID
 * @param playerId - Player UUID
 * @param teamId - Team UUID
 */
export async function recordMVP(
  gameId: string,
  playerId: string,
  teamId: string
): Promise<void> {
  await recordGameEvent(gameId, playerId, teamId, 'mvp', 4);
  await awardSPP(playerId, 4);
}

/**
 * Internal function to record a game event
 */
async function recordGameEvent(
  gameId: string,
  playerId: string,
  teamId: string,
  eventType: string,
  sppAwarded: number
): Promise<void> {
  const { error } = await supabase
    .from('game_events')
    .insert({
      game_id: gameId,
      player_id: playerId,
      team_id: teamId,
      event_type: eventType,
      spp_awarded: sppAwarded
    });

  if (error) throw new Error(`Failed to record game event: ${error.message}`);
}

/**
 * Award SPP to a player
 * @param playerId - Player UUID
 * @param spp - SPP to award
 */
async function awardSPP(playerId: string, spp: number): Promise<void> {
  const { data: player, error: fetchError } = await supabase
    .from('players')
    .select('spp, spp_spent, value')
    .eq('id', playerId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch player: ${fetchError.message}`);

  const newSPP = (player.spp || 0) + spp;
  const newValue = player.value + (spp * 5000);

  const { error: updateError } = await supabase
    .from('players')
    .update({
      spp: newSPP,
      value: newValue
    })
    .eq('id', playerId);

  if (updateError) throw new Error(`Failed to award SPP: ${updateError.message}`);
}

/**
 * Calculate winnings for a team
 * Formula: (D6 × 10,000) × Dedicated Fans
 * @param teamId - Team UUID
 * @returns Winnings amount
 */
export async function calculateWinnings(teamId: string): Promise<number> {
  const { data: team, error } = await supabase
    .from('teams')
    .select('dedicated_fans')
    .eq('id', teamId)
    .single();

  if (error) throw new Error(`Failed to fetch team: ${error.message}`);

  const d6 = Math.floor(Math.random() * 6) + 1;
  return d6 * 10000 * team.dedicated_fans;
}

/**
 * Check for expensive mistakes
 * @param teamId - Team UUID
 * @returns Outcome text or null
 */
export async function checkExpensiveMistakes(teamId: string): Promise<string | null> {
  const { data: team, error } = await supabase
    .from('teams')
    .select('treasury')
    .eq('id', teamId)
    .single();

  if (error) throw new Error(`Failed to fetch team: ${error.message}`);

  // Find applicable expensive mistake entry
  const { data: mistakes, error: mistakesError } = await supabase
    .from('expensive_mistakes')
    .select('*')
    .lte('treasury_min', team.treasury)
    .or(`treasury_max.is.null,treasury_max.gte.${team.treasury}`);

  if (mistakesError) throw new Error(`Failed to fetch expensive mistakes: ${mistakesError.message}`);

  if (!mistakes || mistakes.length === 0) return null;

  // Use the first matching range (should only be one)
  const mistake = mistakes[0];

  // Roll D6
  const d6 = Math.floor(Math.random() * 6) + 1;

  // Find the outcome for this roll
  const { data: outcomes, error: outcomesError } = await supabase
    .from('expensive_mistakes')
    .select('outcome')
    .eq('treasury_min', mistake.treasury_min)
    .eq('d6_roll', d6)
    .single();

  if (outcomesError) return null;

  return outcomes.outcome;
}

/**
 * Revert a friendly game (restore snapshot)
 * @param gameId - Game UUID
 */
export async function revertFriendlyGame(gameId: string): Promise<void> {
  // Get snapshots for this game
  const { data: snapshots, error: snapshotsError } = await supabase
    .from('game_snapshots')
    .select('*')
    .eq('game_id', gameId);

  if (snapshotsError) throw new Error(`Failed to fetch snapshots: ${snapshotsError.message}`);

  if (!snapshots || snapshots.length === 0) {
    throw new Error('No snapshots found for this game');
  }

  // Restore each team
  for (const snapshot of snapshots) {
    const { team, players } = snapshot.snapshot_data as any;

    // Restore team data
    const { error: teamError } = await supabase
      .from('teams')
      .update(team)
      .eq('id', snapshot.team_id);

    if (teamError) throw new Error(`Failed to restore team: ${teamError.message}`);

    // Delete all current players for this team
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('team_id', snapshot.team_id);

    if (deleteError) throw new Error(`Failed to delete players: ${deleteError.message}`);

    // Restore players
    const { error: playersError } = await supabase
      .from('players')
      .insert(players);

    if (playersError) throw new Error(`Failed to restore players: ${playersError.message}`);
  }
}

/**
 * Get player's current advancement level and costs
 * @param playerId - Player UUID
 * @returns Advancement information
 */
export async function getPlayerAdvancementInfo(playerId: string): Promise<{
  currentSPP: number;
  spentSPP: number;
  unspentSPP: number;
  playerLevel: string;
  primaryCost: number;
  secondaryCost: number;
  characteristicCost: number;
  canAdvance: boolean;
}> {
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('spp, spp_spent, player_level')
    .eq('id', playerId)
    .single();

  if (playerError) throw new Error(`Failed to fetch player: ${playerError.message}`);

  const unspentSPP = (player.spp || 0) - (player.spp_spent || 0);

  // Get advancement costs for current level
  const { data: costs, error: costsError } = await supabase
    .from('advancement_costs')
    .select('*')
    .lte('min_spp', player.spp)
    .or(`max_spp.is.null,max_spp.gte.${player.spp}`)
    .single();

  if (costsError) {
    // Default costs if not found
    return {
      currentSPP: player.spp || 0,
      spentSPP: player.spp_spent || 0,
      unspentSPP,
      playerLevel: player.player_level || 'Rookie',
      primaryCost: 3,
      secondaryCost: 6,
      characteristicCost: 9,
      canAdvance: unspentSPP >= 3
    };
  }

  const minCost = Math.min(
    costs.primary_skill_cost,
    costs.secondary_skill_cost,
    costs.characteristic_improvement_cost
  );

  return {
    currentSPP: player.spp || 0,
    spentSPP: player.spp_spent || 0,
    unspentSPP,
    playerLevel: player.player_level || 'Rookie',
    primaryCost: costs.primary_skill_cost,
    secondaryCost: costs.secondary_skill_cost,
    characteristicCost: costs.characteristic_improvement_cost,
    canAdvance: unspentSPP >= minCost
  };
}

/**
 * Roll for random skill (2D6)
 * @param skillCategory - 'Primary' or 'Secondary'
 * @returns Skill name
 */
export async function rollRandomSkill(skillCategory: 'Primary' | 'Secondary'): Promise<string> {
  const d6_1 = Math.floor(Math.random() * 6) + 1;
  const d6_2 = Math.floor(Math.random() * 6) + 1;

  const { data, error } = await supabase
    .from('random_skills')
    .select('skill_name')
    .eq('skill_category', skillCategory)
    .eq('d6_roll_1', d6_1)
    .eq('d6_roll_2', d6_2)
    .single();

  if (error) throw new Error(`Failed to roll random skill: ${error.message}`);

  return data.skill_name;
}

/**
 * Roll for characteristic improvement (D8)
 * @returns Improvement type and value
 */
export async function rollCharacteristicImprovement(): Promise<{
  type: string;
  value: number;
}> {
  const d8 = Math.floor(Math.random() * 8) + 1;

  const { data, error } = await supabase
    .from('characteristic_improvements')
    .select('improvement_type, improvement_value')
    .eq('d8_roll', d8)
    .single();

  if (error) throw new Error(`Failed to roll characteristic improvement: ${error.message}`);

  return {
    type: data.improvement_type,
    value: data.improvement_value
  };
}

/**
 * Apply skill advancement to player
 * @param playerId - Player UUID
 * @param skillName - Skill to add
 * @param cost - SPP cost
 */
export async function applySkillAdvancement(
  playerId: string,
  skillName: string,
  cost: number
): Promise<void> {
  const { data: player, error: fetchError } = await supabase
    .from('players')
    .select('skills, spp_spent, advancements_count, value')
    .eq('id', playerId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch player: ${fetchError.message}`);

  const skills = player.skills || [];
  skills.push(skillName);

  const newSPPSpent = (player.spp_spent || 0) + cost;
  const newAdvancementsCount = (player.advancements_count || 0) + 1;
  const newValue = player.value + (cost * 5000);

  const { error: updateError } = await supabase
    .from('players')
    .update({
      skills,
      spp_spent: newSPPSpent,
      advancements_count: newAdvancementsCount,
      value: newValue
    })
    .eq('id', playerId);

  if (updateError) throw new Error(`Failed to apply skill advancement: ${updateError.message}`);
}

/**
 * Apply characteristic improvement to player
 * @param playerId - Player UUID
 * @param improvementType - 'MA', 'ST', 'AG', 'PA', 'AV'
 * @param improvementValue - Usually +1 or -1
 * @param cost - SPP cost
 */
export async function applyCharacteristicImprovement(
  playerId: string,
  improvementType: string,
  improvementValue: number,
  cost: number
): Promise<void> {
  const { data: player, error: fetchError } = await supabase
    .from('players')
    .select('ma, st, ag, pa, av, spp_spent, advancements_count, value')
    .eq('id', playerId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch player: ${fetchError.message}`);

  const updates: any = {
    spp_spent: (player.spp_spent || 0) + cost,
    advancements_count: (player.advancements_count || 0) + 1,
    value: player.value + (cost * 5000)
  };

  const statKey = improvementType.toLowerCase();
  updates[statKey] = (player as Record<string, any>)[statKey] + improvementValue;

  const { error: updateError } = await supabase
    .from('players')
    .update(updates)
    .eq('id', playerId);

  if (updateError) throw new Error(`Failed to apply characteristic improvement: ${updateError.message}`);
}

/**
 * Complete post-game workflow orchestrator
 * Coordinates all post-game steps in correct order
 * @param gameId - Game UUID
 * @param postGameData - All post-game information
 * @returns Summary of all post-game actions
 */
export async function completePostGameWorkflow(
  gameId: string,
  postGameData: {
    homeScore: number;
    awayScore: number;
    homeStalling?: boolean;
    awayStalling?: boolean;
    casualties?: Array<{
      playerId: string;
      manualRoll?: { d16: number; d6?: number };
    }>;
    events?: {
      touchdowns?: Array<{ playerId: string; teamId: string }>;
      casualties?: Array<{ playerId: string; teamId: string }>;
      completions?: Array<{ playerId: string; teamId: string }>;
      interceptions?: Array<{ playerId: string; teamId: string }>;
      superbThrows?: Array<{ playerId: string; teamId: string }>;
      successfulLandings?: Array<{ playerId: string; teamId: string }>;
      mvps?: Array<{ playerId: string; teamId: string }>;
    };
  }
): Promise<{
  gameResult: string;
  casualtyResults: CasualtyRollResult[];
  homeWinnings: number;
  awayWinnings: number;
  homeFans: number;
  awayFans: number;
  expensiveMistakes: {
    home?: string;
    away?: string;
  };
}> {
  // Get game info
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('home_team_id, away_team_id, game_type')
    .eq('id', gameId)
    .single();

  if (gameError) throw new Error(`Failed to fetch game: ${gameError.message}`);

  // Step 1: Record game result
  await recordGameResult(
    gameId,
    postGameData.homeScore,
    postGameData.awayScore,
    postGameData.homeStalling || false,
    postGameData.awayStalling || false
  );

  const result =
    postGameData.homeScore > postGameData.awayScore
      ? 'home_win'
      : postGameData.awayScore > postGameData.homeScore
      ? 'away_win'
      : 'draw';

  // If this is a friendly, we only process casualties and then revert
  if (game.game_type === 'friendly') {
    let casualtyResults: CasualtyRollResult[] = [];

    if (postGameData.casualties && postGameData.casualties.length > 0) {
      casualtyResults = await processGameCasualties(gameId, postGameData.casualties);
    }

    // Revert the friendly game (restore snapshot)
    await revertFriendlyGame(gameId);

    return {
      gameResult: result,
      casualtyResults,
      homeWinnings: 0,
      awayWinnings: 0,
      homeFans: 0,
      awayFans: 0,
      expensiveMistakes: {}
    };
  }

  // For fixtures, do full post-game processing

  // Step 2: Update dedicated fans
  const homeWon = result === 'home_win';
  const awayWon = result === 'away_win';
  const drew = result === 'draw';

  const [homeFans, awayFans] = await Promise.all([
    updateDedicatedFans(
      game.home_team_id,
      gameId,
      homeWon,
      drew,
      postGameData.awayStalling || false
    ),
    updateDedicatedFans(
      game.away_team_id,
      gameId,
      awayWon,
      drew,
      postGameData.homeStalling || false
    )
  ]);

  // Step 3: Record all game events and award SPP
  if (postGameData.events) {
    const events = postGameData.events;

    // Touchdowns
    if (events.touchdowns) {
      for (const td of events.touchdowns) {
        await recordTouchdown(gameId, td.playerId, td.teamId);
      }
    }

    // Casualties (SPP only, injury rolling handled separately)
    if (events.casualties) {
      for (const cas of events.casualties) {
        await recordCasualty(gameId, cas.playerId, cas.teamId);
      }
    }

    // Completions
    if (events.completions) {
      for (const comp of events.completions) {
        await recordCompletion(gameId, comp.playerId, comp.teamId);
      }
    }

    // Interceptions
    if (events.interceptions) {
      for (const int of events.interceptions) {
        await recordInterception(gameId, int.playerId, int.teamId);
      }
    }

    // Superb Throws
    if (events.superbThrows) {
      for (const st of events.superbThrows) {
        await recordSuperbThrow(gameId, st.playerId, st.teamId);
      }
    }

    // Successful Landings
    if (events.successfulLandings) {
      for (const sl of events.successfulLandings) {
        await recordSuccessfulLanding(gameId, sl.playerId, sl.teamId);
      }
    }

    // MVPs
    if (events.mvps) {
      for (const mvp of events.mvps) {
        await recordMVP(gameId, mvp.playerId, mvp.teamId);
      }
    }
  }

  // Step 4: Process casualties (injuries)
  let casualtyResults: CasualtyRollResult[] = [];
  if (postGameData.casualties && postGameData.casualties.length > 0) {
    casualtyResults = await processGameCasualties(gameId, postGameData.casualties);
  }

  // Step 5: Calculate winnings
  const [homeWinnings, awayWinnings] = await Promise.all([
    calculateWinnings(game.home_team_id),
    calculateWinnings(game.away_team_id)
  ]);

  // Step 6: Check for expensive mistakes
  const [homeExpensiveMistake, awayExpensiveMistake] = await Promise.all([
    checkExpensiveMistakes(game.home_team_id),
    checkExpensiveMistakes(game.away_team_id)
  ]);

  const expensiveMistakes: any = {};
  if (homeExpensiveMistake) expensiveMistakes.home = homeExpensiveMistake;
  if (awayExpensiveMistake) expensiveMistakes.away = awayExpensiveMistake;

  // Add winnings to treasury
  await supabase.rpc('add_to_treasury', {
    p_team_id: game.home_team_id,
    p_amount: homeWinnings
  });

  await supabase.rpc('add_to_treasury', {
    p_team_id: game.away_team_id,
    p_amount: awayWinnings
  });

  return {
    gameResult: result,
    casualtyResults,
    homeWinnings,
    awayWinnings,
    homeFans,
    awayFans,
    expensiveMistakes
  };
}
