import { useState, useEffect } from 'react';
import { useTeams } from '../../hooks/useTeam';
import { getTeamRoster } from '../../lib/db-queries';
import { supabase } from '../../config/supabase';
import CoachLayout from '../../components/layouts/CoachLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import TeamSummaryPanel from '../../components/roster/TeamSummaryPanel';

export default function MyTeamPage() {
  const { teams, isLoading } = useTeams();
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [editingMemorialName, setEditingMemorialName] = useState(false);
  const [memorialName, setMemorialName] = useState('');

  const currentTeam = teams[selectedTeamIndex];

  useEffect(() => {
    const fetchPlayers = async () => {
      if (!currentTeam) return;

      setLoadingPlayers(true);
      try {
        const data = await getTeamRoster(currentTeam.id);
        setPlayers(data || []);
        // Set memorial name from team or use default
        setMemorialName(currentTeam.memorial_name || 'The Honored Dead');
      } catch (err) {
        console.error('Failed to fetch roster:', err);
        setPlayers([]);
      } finally {
        setLoadingPlayers(false);
      }
    };

    fetchPlayers();
  }, [currentTeam?.id]);

  const deadPlayers = players.filter(p => p.status === 'dead');

  const saveMemorialName = async () => {
    try {
      const { error } = await supabase
        .from('teams')
        .update({ memorial_name: memorialName })
        .eq('id', currentTeam.id);

      if (error) throw error;
      setEditingMemorialName(false);
    } catch (err) {
      console.error('Failed to save memorial name:', err);
    }
  };

  if (isLoading || loadingPlayers) return <LoadingSpinner />;

  if (!teams || teams.length === 0) {
    return (
      <CoachLayout>
        <div className="text-center py-12">
          <p className="text-xl text-gray-600">You don't have a team yet!</p>
        </div>
      </CoachLayout>
    );
  }

  const availablePlayers = players.filter(
    p => !p.miss_next_game && ['active', 'injured'].includes(p.status)
  );

  return (
    <CoachLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">My Team</h1>

        {/* Team Selector - show only if user has multiple teams */}
        {teams.length > 1 && (
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Team
            </label>
            <div className="flex gap-2">
              {teams.map((team, index) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamIndex(index)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    index === selectedTeamIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Team Summary Panel */}
        <TeamSummaryPanel
          team={currentTeam}
          playerCount={players.length}
          availablePlayerCount={availablePlayers.length}
        />

        {/* Memorial Section - Dead Players */}
        {deadPlayers.length > 0 && (
          <div className="bg-gray-900 shadow rounded-lg p-6 text-white">
            <div className="flex justify-between items-center mb-4">
              {editingMemorialName ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={memorialName}
                    onChange={(e) => setMemorialName(e.target.value)}
                    className="px-3 py-1 border rounded text-gray-900 flex-1"
                    placeholder="Memorial name..."
                  />
                  <button
                    onClick={saveMemorialName}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setMemorialName(currentTeam.memorial_name || 'The Honored Dead');
                      setEditingMemorialName(false);
                    }}
                    className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold">☠️ {memorialName}</h3>
                  <button
                    onClick={() => setEditingMemorialName(true)}
                    className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                  >
                    Edit Name
                  </button>
                </>
              )}
            </div>
            <div className="border-t border-gray-700 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deadPlayers.map((player) => (
                  <div key={player.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg">{player.name}</div>
                        <div className="text-sm text-gray-400">#{player.number} - {player.position}</div>
                      </div>
                      <div className="text-xs bg-black px-2 py-1 rounded">DEAD</div>
                    </div>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div className="flex justify-between">
                        <span>SPP:</span>
                        <span className="font-semibold">{player.spp || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TDs:</span>
                        <span className="font-semibold">{player.touchdowns || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Casualties:</span>
                        <span className="font-semibold">{player.casualties || 0}</span>
                      </div>
                      {player.injury_details && (
                        <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-red-400">
                          {player.injury_details}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Team Management</h3>
          <p className="text-gray-600 mb-4">
            Team management features (buy staff, fans, rerolls) coming soon!
            For now, use the Discord bot commands:
          </p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li><code className="bg-gray-100 px-2 py-1 rounded">/buy-staff</code> - Hire assistant coaches, cheerleaders, or apothecary</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">/buy-fans</code> - Purchase dedicated fans</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">/buy-rerolls</code> - Purchase team rerolls</li>
          </ul>
        </div>
      </div>
    </CoachLayout>
  );
}
