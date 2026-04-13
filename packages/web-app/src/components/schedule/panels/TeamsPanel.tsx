/**
 * TeamsPanel Component
 *
 * Draggable list of all teams in the league.
 * Teams can be dragged onto game slots for assignment.
 * This is displayed INSIDE the right sidebar, not as a modal.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../config/supabase';

interface Team {
  id: string;
  name: string;
  logo_url?: string;
  division?: number;
  coach_name?: string;
  user_id?: string;
}

interface TeamsPanelProps {
  leagueId: string;
}

type SortOption = 'alphabetical' | 'division' | 'unassigned';

export default function TeamsPanel({ leagueId }: TeamsPanelProps) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('alphabetical');

  useEffect(() => {
    loadTeams();
  }, [leagueId]);

  const loadTeams = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          division,
          team_ownership!team_ownership_team_id_fkey (
            user_id,
            owner:users!team_ownership_user_id_fkey (
              display_name
            )
          )
        `)
        .eq('league_id', leagueId)
        .eq('active', true);

      if (error) throw error;

      console.log('[TeamsPanel] Raw data from Supabase:', data);
      console.log('[TeamsPanel] League ID filter:', leagueId);

      const teamsWithCoaches = (data || []).map(team => {
        // Get the first owner (primary coach)
        const ownership = Array.isArray(team.team_ownership) ? team.team_ownership[0] : team.team_ownership;
        const coachName = (ownership?.owner as any)?.display_name || 'No coach assigned';

        console.log('[TeamsPanel] Processing team:', {
          name: team.name,
          ownership,
          coachName
        });

        return {
          id: team.id,
          name: team.name,
          logo_url: undefined, // logo_url column doesn't exist in schema
          division: team.division,
          user_id: ownership?.user_id,
          coach_name: coachName,
        };
      });

      console.log('[TeamsPanel] Processed teams:', teamsWithCoaches);
      setTeams(teamsWithCoaches);
    } catch (err) {
      console.error('Error loading teams:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const sortedTeams = [...teams].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'division') {
      if (a.division == null && b.division == null) return 0;
      if (a.division == null) return 1;
      if (b.division == null) return -1;
      if (a.division !== b.division) return a.division - b.division;
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'unassigned') {
      if (a.division == null && b.division == null) return a.name.localeCompare(b.name);
      if (a.division == null) return -1;
      if (b.division == null) return 1;
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  return (
    <div className="space-y-3">
      {/* Sort Options */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1 block">
          Sort by
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="alphabetical">Alphabetical</option>
          <option value="division">Division</option>
          <option value="unassigned">Unassigned first</option>
        </select>
      </div>

      {/* Teams List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-sm text-gray-500">
            Loading teams...
          </div>
        ) : sortedTeams.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No teams found
          </div>
        ) : (
          sortedTeams.map((team) => (
            <div
              key={team.id}
              className="border border-gray-200 rounded p-2 hover:bg-gray-50 cursor-move transition-colors"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('teamId', team.id);
                e.dataTransfer.setData('teamName', team.name);
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <div className="flex items-start gap-2">
                {/* Team Logo */}
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
                  {team.logo_url ? (
                    <img
                      src={team.logo_url}
                      alt={team.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-400 text-xs">?</span>
                  )}
                </div>

                {/* Team Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {team.name}
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {team.coach_name}
                  </div>
                  {team.division !== null && (
                    <div className="text-xs text-gray-500">
                      Division {team.division}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Team Button */}
      <button
        onClick={() => navigate('/coach/create-team', { state: { returnPath: '/commissioner/schedule' } })}
        className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        + Add A Team
      </button>
    </div>
  );
}
