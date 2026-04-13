import { useState, useEffect } from 'react';
import { getUserTeam } from '../lib/db-queries';
import { useAuth } from './useAuth';
import { supabase } from '../config/supabase';

// Hook to fetch all teams owned by the current user
export function useTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeams() {
      if (!user || !user.teamIds || user.teamIds.length === 0) {
        console.log('[useTeams] No user or no teams');
        setIsLoading(false);
        return;
      }

      try {
        console.log('[useTeams] Fetching teams for teamIds:', user.teamIds);

        // Fetch all teams at once
        const { data, error: fetchError } = await supabase
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
          .in('id', user.teamIds)
          .order('name', { ascending: true });

        if (fetchError) throw fetchError;

        console.log('[useTeams] Fetched teams:', data);
        setTeams(data || []);
      } catch (err) {
        console.error('[useTeams] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch teams');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeams();
  }, [user?.teamIds?.join(',')]); // Depend on teamIds array

  return { teams, isLoading, error };
}

// Backward compatibility: fetch a single team (first team or specified teamId)
export function useTeam(teamId?: string) {
  const { user } = useAuth();
  const [team, setTeam] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeam() {
      if (!user) {
        console.log('[useTeam] No user found');
        setIsLoading(false);
        return;
      }

      try {
        console.log('[useTeam] User object:', JSON.stringify(user, null, 2));
        const targetTeamId = teamId || user.teamId;
        console.log('[useTeam] Fetching team for user:', user.userId, 'teamId:', targetTeamId);
        const data = await getUserTeam(user.userId, targetTeamId);
        console.log('[useTeam] Team data:', data);
        setTeam(data);
      } catch (err) {
        console.error('[useTeam] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch team');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTeam();
  }, [user, teamId]);

  return { team, isLoading, error };
}
