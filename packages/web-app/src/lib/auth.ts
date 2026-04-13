import { supabase } from '../config/supabase';
import { AuthenticatedUser } from '../types/auth';
import { ensureLeagueExists } from './league-init';

// Sign in with Discord using Supabase Auth
export async function signInWithDiscord() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    console.error('Discord OAuth error:', error);
    throw error;
  }

  return data;
}

// Handle auth callback and sync user with database
export async function handleAuthCallback(): Promise<AuthenticatedUser> {
  // Supabase automatically handles the OAuth callback and sets the session
  // We just need to wait a moment for it to process
  let session = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (!session && attempts < maxAttempts) {
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    if (currentSession) {
      session = currentSession;
      break;
    }

    // Wait 300ms before trying again
    await new Promise(resolve => setTimeout(resolve, 300));
    attempts++;
  }

  if (!session) {
    throw new Error('No active session after OAuth callback');
  }

  return await syncUserFromSession(session);
}

async function syncUserFromSession(session: any): Promise<AuthenticatedUser> {

  const supabaseUser = session.user;

  // Extract Discord info from user metadata
  const discordId = supabaseUser.user_metadata?.provider_id || supabaseUser.id;
  const discordUsername = supabaseUser.user_metadata?.custom_claims?.global_name
    || supabaseUser.user_metadata?.name
    || supabaseUser.email?.split('@')[0]
    || 'Unknown';

  // Check if user exists in our users table
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, display_name, email')
    .eq('discord_id', discordId)
    .maybeSingle();

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;

    // Update last_active timestamp
    await supabase
      .from('users')
      .update({ last_active: new Date().toISOString() })
      .eq('id', userId);
  } else {
    // Create new user entry in our users table
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        discord_id: discordId,
        discord_username: discordUsername,
        display_name: discordUsername,
        email: supabaseUser.email,
      })
      .select('id')
      .single();

    if (createError || !newUser) {
      console.error('Failed to create user:', createError);
      throw new Error('Failed to create user');
    }

    userId = newUser.id;
  }

  // Auto-initialize league infrastructure if it doesn't exist
  await ensureLeagueExists(userId);

  // Fetch user roles
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('league_id, role')
    .eq('user_id', userId);

  const roles = (rolesData || []).map(r => ({
    leagueId: r.league_id,
    role: r.role as 'commissioner' | 'asst_commissioner' | 'coach'
  }));

  // Fetch team ownerships
  const { data: teamOwnerships } = await supabase
    .from('team_ownership')
    .select('team_id')
    .eq('user_id', userId)
    .order('granted_at', { ascending: true });

  const teamIds = (teamOwnerships || []).map(o => o.team_id);

  return {
    userId,
    discordId,
    discordUsername,
    displayName: existingUser?.display_name || discordUsername,
    email: existingUser?.email || supabaseUser.email,
    roles,
    teamIds,
    teamId: teamIds[0],
  };
}

// Get current authenticated user
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  try {
    return await handleAuthCallback();
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}
