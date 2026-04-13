import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeague } from '../../hooks/useLeague';
import { supabase } from '../../config/supabase';
import CommissionerLayout from '../../components/layouts/CommissionerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';

interface Team {
  id: string;
  name: string;
  race: string;
  tier: number;
  wins: number;
  losses: number;
  ties: number;
  league_points: number;
  treasury: number;
  team_value: number;
  owner?: {
    display_name: string;
    discord_username: string;
  };
}

export default function AllTeamsPage() {
  const navigate = useNavigate();
  const { league, isLoading: leagueLoading } = useLeague();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [newOwnerDiscordId, setNewOwnerDiscordId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchTeams = async () => {
    if (!league) return;

    try {
      setIsLoading(true);

      // Fetch teams with owner information (only active teams)
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          race,
          tier,
          wins,
          losses,
          ties,
          league_points,
          treasury,
          team_value
        `)
        .eq('league_id', league.id)
        .is('deleted_at', null)
        .order('league_points', { ascending: false });

      if (teamsError) throw teamsError;

      // Fetch ownership info for each team
      const teamsWithOwners = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { data: ownership } = await supabase
            .from('team_ownership')
            .select(`
              user_id,
              users!team_ownership_user_id_fkey(display_name, discord_username)
            `)
            .eq('team_id', team.id)
            .eq('role', 'owner')
            .maybeSingle();

          return {
            ...team,
            owner: ownership?.users
          };
        })
      );

      setTeams(teamsWithOwners);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch teams');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (league) {
      fetchTeams();
    }
  }, [league]);

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;

    try {
      setIsProcessing(true);

      // Soft delete team by setting deleted_at timestamp
      const { error } = await supabase
        .from('teams')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', selectedTeam.id);

      if (error) throw error;

      setShowDeleteModal(false);
      setSelectedTeam(null);
      await fetchTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedTeam || !newOwnerDiscordId.trim()) return;

    try {
      setIsProcessing(true);

      // Find user by Discord ID
      const { data: newOwner, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('discord_id', newOwnerDiscordId.trim())
        .maybeSingle();

      if (userError || !newOwner) {
        throw new Error('User not found with that Discord ID');
      }

      // Delete old ownership
      await supabase
        .from('team_ownership')
        .delete()
        .eq('team_id', selectedTeam.id);

      // Create new ownership
      const { error: ownershipError } = await supabase
        .from('team_ownership')
        .insert({
          team_id: selectedTeam.id,
          user_id: newOwner.id,
          role: 'owner',
          granted_by: newOwner.id,
        });

      if (ownershipError) throw ownershipError;

      setShowTransferModal(false);
      setSelectedTeam(null);
      setNewOwnerDiscordId('');
      await fetchTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    } finally {
      setIsProcessing(false);
    }
  };

  if (leagueLoading || isLoading) return <LoadingSpinner />;

  return (
    <CommissionerLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">All Teams</h1>
          <button
            onClick={() => navigate('/coach/create-team', { state: { returnPath: '/commissioner/teams' } })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Add A Team
          </button>
        </div>

        {error && <ErrorMessage message={error} />}

        {teams.length === 0 ? (
          <p className="text-gray-600">No teams have been created yet.</p>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Race
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Record
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Points
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Treasury
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teams.map((team) => (
                  <tr key={team.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{team.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {team.owner?.display_name || 'No owner'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{team.race}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {team.wins}-{team.losses}-{team.ties}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">{team.league_points}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{team.treasury.toLocaleString()}g</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{team.team_value.toLocaleString()}g</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          setSelectedTeam(team);
                          setShowTransferModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Transfer
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTeam(team);
                          setShowDeleteModal(true);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedTeam && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Delete Team</h2>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete <strong>{selectedTeam.name}</strong>? The team will be hidden from the active teams list but all historical data (matches, players, etc.) will be preserved. You can archive deleted teams at the end of the season.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedTeam(null);
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteTeam}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isProcessing ? 'Deleting...' : 'Delete Team'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Ownership Modal */}
        {showTransferModal && selectedTeam && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Transfer Ownership</h2>
              <p className="text-gray-700 mb-4">
                Transfer ownership of <strong>{selectedTeam.name}</strong> to another user.
              </p>
              <div className="mb-6">
                <label htmlFor="discordId" className="block text-sm font-medium text-gray-700 mb-2">
                  New Owner's Discord ID
                </label>
                <input
                  type="text"
                  id="discordId"
                  value={newOwnerDiscordId}
                  onChange={(e) => setNewOwnerDiscordId(e.target.value)}
                  placeholder="e.g., 1238122293931282547"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The user must have already logged in to the system at least once.
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedTeam(null);
                    setNewOwnerDiscordId('');
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransferOwnership}
                  disabled={isProcessing || !newOwnerDiscordId.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isProcessing ? 'Transferring...' : 'Transfer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CommissionerLayout>
  );
}
