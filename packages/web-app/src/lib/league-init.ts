import { supabase } from '../config/supabase';

/**
 * Auto-initialize league infrastructure if it doesn't exist
 * This should be called when the first user authenticates
 * @returns true if league was just created, false otherwise
 */
export async function ensureLeagueExists(userId: string): Promise<boolean> {
  try {
    // Check if a league already exists
    const { data: existingLeague } = await supabase
      .from('leagues')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingLeague) {
      // League already exists, nothing to do
      return false;
    }

    console.log('No league found - auto-initializing league infrastructure...');

    // Create the league with default settings
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name: 'Blood Bowl League', // Can be changed later in settings
        season_number: 1,
        season_status: 'setup', // Valid enum: setup, active, playoffs, closed
        commissioner_id: userId,
        // Default settings
        max_teams: 8,
        min_teams: 4,
        divisions: 1,
        games_per_season: 10,
        win_points: 3,
        tie_points: 1,
        loss_points: 0,
        attendance_threshold: 3,
        playoff_format: 'top_4_bracket',
        playoff_seeding: 'by_points',
        home_advantage: false,
        starting_treasury: 1000000,
      })
      .select()
      .single();

    if (leagueError) {
      console.error('Failed to create league:', leagueError);
      throw leagueError;
    }

    console.log('✓ League created:', league.id);

    // Grant commissioner and coach roles to the first user
    const { error: rolesError } = await supabase
      .from('user_roles')
      .insert([
        {
          league_id: league.id,
          user_id: userId,
          role: 'commissioner',
          granted_by: userId,
        },
        {
          league_id: league.id,
          user_id: userId,
          role: 'coach',
          granted_by: userId,
        },
      ]);

    if (rolesError) {
      console.error('Failed to grant roles:', rolesError);
      throw rolesError;
    }

    console.log('✓ Granted commissioner and coach roles to first user');
    console.log('✓ League infrastructure initialized successfully');

    return true; // Indicate league was just created
  } catch (error) {
    console.error('Failed to initialize league:', error);
    // Don't throw - let the app continue, user can manually create league if needed
    return false;
  }

  return false; // League already existed
}

/**
 * Check if user has any roles, and if league exists but user has no roles,
 * this might indicate they need to be granted access
 */
export async function checkUserRoles(userId: string): Promise<{
  hasRoles: boolean;
  leagueExists: boolean;
}> {
  const { data: league } = await supabase
    .from('leagues')
    .select('id')
    .limit(1)
    .maybeSingle();

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  return {
    hasRoles: (roles?.length || 0) > 0,
    leagueExists: !!league,
  };
}
