import { supabase } from '../config/supabase';

// Get the single league (single-league model)
export async function getLeague() {
  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, season_number, season_status, rules_config, commissioner_id')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('getLeague error:', error);
    throw error;
  }

  return data; // Returns null if no league exists
}

// Get all teams in the league
export async function getAllTeams(leagueId: string) {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      race,
      tier,
      division,
      treasury,
      team_value,
      dedicated_fans,
      rerolls,
      wins,
      losses,
      ties,
      league_points,
      total_sobs,
      active,
      assistant_coaches,
      cheerleaders,
      apothecary_hired
    `)
    .eq('league_id', leagueId)
    .order('league_points', { ascending: false });

  if (error) throw error;
  return data;
}

// Get user's team via team_ownership
export async function getUserTeam(userId: string, teamId?: string) {
  // If teamId is provided, fetch directly
  if (teamId) {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        id,
        name,
        race,
        tier,
        division,
        treasury,
        team_value,
        dedicated_fans,
        min_dedicated_fans,
        rerolls,
        wins,
        losses,
        ties,
        league_points,
        total_sobs,
        active,
        assistant_coaches,
        cheerleaders,
        apothecary_hired
      `)
      .eq('id', teamId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    return data;
  }

  // Query via team_ownership using the foreign key relationship
  console.log('[getUserTeam] Querying team_ownership for userId:', userId);

  const { data, error } = await supabase
    .from('team_ownership')
    .select(`
      teams (
        id,
        name,
        race,
        tier,
        division,
        treasury,
        team_value,
        dedicated_fans,
        min_dedicated_fans,
        rerolls,
        wins,
        losses,
        ties,
        league_points,
        total_sobs,
        active,
        assistant_coaches,
        cheerleaders,
        apothecary_hired
      )
    `)
    .eq('user_id', userId)
    .maybeSingle();

  console.log('[getUserTeam] Query result:', { data, error });

  if (error) {
    console.error('[getUserTeam] Error:', error);
    throw error;
  }

  // Extract the team from the nested structure
  const team = data?.teams || null;
  console.log('[getUserTeam] Returning team:', team);
  return team;
}

// Get team roster (players) - excludes dead players
export async function getTeamRoster(teamId: string) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .neq('status', 'dead')
    .order('number', { ascending: true });

  if (error) throw error;
  return data;
}

// Get user roles (for role detection)
export async function getUserRoles(userId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('league_id, role')
    .eq('user_id', userId);

  if (error) throw error;
  return data;
}

// Get all coaches in the league
export async function getLeagueCoaches(leagueId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      users (
        id,
        display_name,
        discord_username
      )
    `)
    .eq('league_id', leagueId)
    .eq('role', 'coach');

  if (error) throw error;
  return data;
}
