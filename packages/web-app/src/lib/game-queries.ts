import { supabase } from '../config/supabase';

/**
 * Get next upcoming match for a team
 * @param teamId - Team UUID
 * @returns Next scheduled match or null
 */
export async function getNextGame(teamId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id,
      league_id,
      home_team_id,
      away_team_id,
      match_type,
      scheduled_date,
      location,
      week_number,
      completed,
      home_ready,
      away_ready,
      home_roster_locked,
      away_roster_locked,
      roster_lock_deadline,
      bounty_status,
      bounty_claimed_by,
      status,
      home_score,
      away_score,
      result,
      home_team:teams!matches_home_team_id_fkey(id, name, race, wins, losses, ties, team_value),
      away_team:teams!matches_away_team_id_fkey(id, name, race, wins, losses, ties, team_value)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('completed', false)
    .order('scheduled_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get upcoming matches for a team (excluding next match)
 * @param teamId - Team UUID
 * @param limit - Max number of matches to return
 * @returns Array of upcoming matches
 */
export async function getUpcomingGames(teamId: string, limit: number = 10) {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      id,
      home_team_id,
      away_team_id,
      match_type,
      scheduled_date,
      location,
      week_number,
      home_ready,
      away_ready,
      home_roster_locked,
      away_roster_locked,
      home_team:teams!matches_home_team_id_fkey(id, name, race, wins, losses, ties),
      away_team:teams!matches_away_team_id_fkey(id, name, race, wins, losses, ties)
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('completed', false)
    .order('scheduled_date', { ascending: true })
    .limit(limit + 1); // Get one extra to skip the first

  if (error) throw error;

  // Skip the first match (that's the "next" match)
  return data?.slice(1) || [];
}

/**
 * Toggle team readiness for a match
 * @param gameId - Match UUID
 * @param teamId - Team UUID
 * @param ready - Ready status
 */
export async function setTeamReady(gameId: string, teamId: string, ready: boolean) {
  // First, check if this team is home or away
  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('id', gameId)
    .single();

  if (fetchError) throw fetchError;

  const isHome = match.home_team_id === teamId;
  const field = isHome ? 'home_ready' : 'away_ready';

  const { error } = await supabase
    .from('matches')
    .update({ [field]: ready })
    .eq('id', gameId);

  if (error) throw error;
}

/**
 * Lock team roster for a match
 * @param gameId - Match UUID
 * @param teamId - Team UUID
 */
export async function lockTeamRoster(gameId: string, teamId: string) {
  // First, check if this team is home or away
  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id')
    .eq('id', gameId)
    .single();

  if (fetchError) throw fetchError;

  const isHome = match.home_team_id === teamId;
  const lockField = isHome ? 'home_roster_locked' : 'away_roster_locked';
  const timeField = isHome ? 'home_roster_locked_at' : 'away_roster_locked_at';

  const { error } = await supabase
    .from('matches')
    .update({
      [lockField]: true,
      [timeField]: new Date().toISOString()
    })
    .eq('id', gameId);

  if (error) throw error;
}

/**
 * Get team's CTV and related info for a match
 * Only returns opponent info if both rosters are locked
 * @param gameId - Match UUID
 * @param teamId - Team UUID (the requesting team)
 */
export async function getGameTeamInfo(gameId: string, teamId: string) {
  const { data: match, error } = await supabase
    .from('matches')
    .select(`
      id,
      home_team_id,
      away_team_id,
      home_roster_locked,
      away_roster_locked,
      home_team:teams!matches_home_team_id_fkey(
        id,
        name,
        race,
        treasury,
        team_value,
        dedicated_fans,
        rerolls,
        assistant_coaches,
        cheerleaders,
        apothecary_hired,
        wins,
        losses,
        ties
      ),
      away_team:teams!matches_away_team_id_fkey(
        id,
        name,
        race,
        treasury,
        team_value,
        dedicated_fans,
        rerolls,
        assistant_coaches,
        cheerleaders,
        apothecary_hired,
        wins,
        losses,
        ties
      )
    `)
    .eq('id', gameId)
    .single();

  if (error) throw error;

  const isHome = match.home_team_id === teamId;
  const myTeam = isHome ? match.home_team : match.away_team;
  const opponentTeam = isHome ? match.away_team : match.home_team;
  const bothLocked = match.home_roster_locked && match.away_roster_locked;

  return {
    myTeam,
    opponentTeam: bothLocked ? opponentTeam : null,
    bothRostersLocked: bothLocked,
    isHome
  };
}

/**
 * Update the status of a match
 * @param gameId - Match UUID
 * @param status - New status ('scheduled' | 'in_progress' | 'completed')
 */
export async function updateMatchStatus(gameId: string, status: 'scheduled' | 'in_progress' | 'completed') {
  const updates: Record<string, any> = { status };
  if (status === 'completed') updates.completed = true;

  const { error } = await supabase
    .from('matches')
    .update(updates)
    .eq('id', gameId);

  if (error) throw error;
}

/**
 * Get all active players for both teams in a match (for casualty selection)
 * @param homeTeamId - Home team UUID
 * @param awayTeamId - Away team UUID
 */
export async function getMatchPlayers(homeTeamId: string, awayTeamId: string) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, position, team_id, status')
    .in('team_id', [homeTeamId, awayTeamId])
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Calculate current winning/losing streak for a team
 * @param teamId - Team UUID
 * @returns Streak object { type: 'W' | 'L' | 'D', count: number }
 */
export async function getTeamStreak(teamId: string) {
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      id,
      home_team_id,
      away_team_id,
      result,
      scheduled_date
    `)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq('completed', true)
    .order('scheduled_date', { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!matches || matches.length === 0) return { type: null, count: 0 };

  let streakType: 'W' | 'L' | 'D' | null = null;
  let streakCount = 0;

  for (const match of matches) {
    const isHome = match.home_team_id === teamId;
    let matchResult: 'W' | 'L' | 'D';

    if (match.result === 'draw') {
      matchResult = 'D';
    } else if (
      (isHome && match.result === 'home_win') ||
      (!isHome && match.result === 'away_win')
    ) {
      matchResult = 'W';
    } else {
      matchResult = 'L';
    }

    if (streakType === null) {
      streakType = matchResult;
      streakCount = 1;
    } else if (streakType === matchResult) {
      streakCount++;
    } else {
      break;
    }
  }

  return { type: streakType, count: streakCount };
}
