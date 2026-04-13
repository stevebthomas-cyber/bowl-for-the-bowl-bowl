import { supabase } from '../config/supabase';
import type {
  TeamArchiveData,
  PlayerArchiveData,
  MatchArchiveData,
  StatsArchiveSummary,
  LeagueSettingsArchive,
  SeasonArchive
} from '../types/archive';

/**
 * Archives a single team's season data as a JSON blob
 */
export async function archiveTeamSeason(
  leagueId: string,
  teamId: string,
  seasonNumber: number
): Promise<SeasonArchive> {
  // Fetch team data
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (teamError) throw teamError;
  if (!team) throw new Error(`Team ${teamId} not found`);

  // Fetch roster data (all players, including injured/dead)
  const { data: roster, error: rosterError } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .order('number', { ascending: true });

  if (rosterError) throw rosterError;

  // Fetch all matches for this team this season
  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      id,
      week,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      home_casualties,
      away_casualties,
      played_at,
      is_playoff,
      home_team:teams!matches_home_team_id_fkey(name),
      away_team:teams!matches_away_team_id_fkey(name)
    `)
    .eq('league_id', leagueId)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('week', { ascending: true });

  if (matchesError) throw matchesError;

  // Fetch league data
  const { data: league, error: leagueError } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single();

  if (leagueError) throw leagueError;
  if (!league) throw new Error(`League ${leagueId} not found`);

  // Calculate stats summary
  const totalTouchdowns = roster?.reduce((sum, p) => sum + (p.touchdowns || 0), 0) || 0;
  const totalCasualties = roster?.reduce((sum, p) => sum + (p.casualties_inflicted || 0), 0) || 0;
  const totalCompletions = roster?.reduce((sum, p) => sum + (p.passing_completions || 0), 0) || 0;
  const totalInterceptions = roster?.reduce((sum, p) => sum + (p.interceptions || 0), 0) || 0;
  const totalMvps = roster?.reduce((sum, p) => sum + (p.mvps || 0), 0) || 0;
  const totalSpp = roster?.reduce((sum, p) => sum + (p.spp || 0), 0) || 0;
  const gamesPlayed = (team.wins || 0) + (team.losses || 0) + (team.ties || 0);

  // Get final standing (requires fetching all teams and sorting)
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, league_points')
    .eq('league_id', leagueId)
    .order('league_points', { ascending: false });

  const finalStanding = (allTeams?.findIndex(t => t.id === teamId) || 0) + 1;

  // Build archive data structures
  const teamArchiveData: TeamArchiveData = {
    id: team.id,
    name: team.name,
    roster_id: team.roster_id,
    treasury: team.treasury,
    team_value: team.team_value,
    current_team_value: team.current_team_value,
    rerolls: team.rerolls,
    assistant_coaches: team.assistant_coaches,
    cheerleaders: team.cheerleaders,
    apothecary_hired: team.apothecary_hired,
    dedicated_fans: team.dedicated_fans,
    wins: team.wins,
    losses: team.losses,
    ties: team.ties,
    league_points: team.league_points
  };

  const rosterArchiveData: PlayerArchiveData[] = (roster || []).map(player => ({
    id: player.id,
    name: player.name,
    position: player.position,
    number: player.number,
    movement: player.movement,
    strength: player.strength,
    agility: player.agility,
    passing: player.passing,
    armor_value: player.armor_value,
    skills: player.skills || [],
    touchdowns: player.touchdowns || 0,
    casualties_inflicted: player.casualties_inflicted || 0,
    passing_completions: player.passing_completions || 0,
    interceptions: player.interceptions || 0,
    deflections: player.deflections || 0,
    mvps: player.mvps || 0,
    spp: player.spp || 0,
    niggling_injuries: player.niggling_injuries || 0,
    miss_next_game: player.miss_next_game || false,
    status: player.status
  }));

  const matchesArchiveData: MatchArchiveData[] = (matches || []).map(match => ({
    id: match.id,
    week: match.week,
    home_team_id: match.home_team_id,
    away_team_id: match.away_team_id,
    home_team_name: (match.home_team as any)?.name || '',
    away_team_name: (match.away_team as any)?.name || '',
    home_score: match.home_score || 0,
    away_score: match.away_score || 0,
    home_casualties: match.home_casualties || 0,
    away_casualties: match.away_casualties || 0,
    played_at: match.played_at,
    is_playoff: match.is_playoff || false
  }));

  const statsSummary: StatsArchiveSummary = {
    total_touchdowns: totalTouchdowns,
    total_casualties: totalCasualties,
    total_completions: totalCompletions,
    total_interceptions: totalInterceptions,
    total_mvps: totalMvps,
    total_spp_earned: totalSpp,
    games_played: gamesPlayed,
    final_standing: finalStanding,
    final_league_points: team.league_points,
    made_playoffs: false // TODO: Determine from playoff matches once implemented
  };

  const leagueSettingsArchive: LeagueSettingsArchive = {
    name: league.name,
    season_status: league.season_status,
    max_teams: league.max_teams,
    divisions: league.divisions,
    games_per_season: league.games_per_season,
    win_points: league.win_points,
    tie_points: league.tie_points,
    loss_points: league.loss_points,
    attendance_threshold: league.attendance_threshold,
    playoff_format: league.playoff_format,
    playoff_seeding: league.playoff_seeding,
    home_advantage: league.home_advantage,
    rules_config: league.rules_config
  };

  // Insert archive record
  const { data: archive, error: archiveError } = await supabase
    .from('season_archives')
    .insert({
      league_id: leagueId,
      team_id: teamId,
      season_number: seasonNumber,
      team_data: teamArchiveData,
      roster_data: rosterArchiveData,
      matches_data: matchesArchiveData,
      stats_summary: statsSummary,
      league_settings: leagueSettingsArchive
    })
    .select()
    .single();

  if (archiveError) throw archiveError;
  return archive as SeasonArchive;
}

/**
 * Archives the entire season for all teams in the league
 */
export async function archiveEntireSeason(
  leagueId: string,
  seasonNumber: number
): Promise<SeasonArchive[]> {
  // Get all teams in the league
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id')
    .eq('league_id', leagueId);

  if (teamsError) throw teamsError;
  if (!teams || teams.length === 0) {
    throw new Error('No teams found in league');
  }

  // Archive each team
  const archives: SeasonArchive[] = [];
  for (const team of teams) {
    const archive = await archiveTeamSeason(leagueId, team.id, seasonNumber);
    archives.push(archive);
  }

  return archives;
}

/**
 * Get archived seasons for a specific team
 */
export async function getTeamSeasonArchives(teamId: string): Promise<SeasonArchive[]> {
  const { data, error } = await supabase
    .from('season_archives')
    .select('*')
    .eq('team_id', teamId)
    .order('season_number', { ascending: false });

  if (error) throw error;
  return data as SeasonArchive[];
}

/**
 * Get a specific season archive
 */
export async function getSeasonArchive(
  teamId: string,
  seasonNumber: number
): Promise<SeasonArchive | null> {
  const { data, error } = await supabase
    .from('season_archives')
    .select('*')
    .eq('team_id', teamId)
    .eq('season_number', seasonNumber)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw error;
  }

  return data as SeasonArchive;
}

/**
 * Get all archived seasons for a league
 */
export async function getLeagueSeasonArchives(
  leagueId: string,
  seasonNumber?: number
): Promise<SeasonArchive[]> {
  let query = supabase
    .from('season_archives')
    .select('*')
    .eq('league_id', leagueId);

  if (seasonNumber !== undefined) {
    query = query.eq('season_number', seasonNumber);
  }

  const { data, error } = await query.order('season_number', { ascending: false });

  if (error) throw error;
  return data as SeasonArchive[];
}
