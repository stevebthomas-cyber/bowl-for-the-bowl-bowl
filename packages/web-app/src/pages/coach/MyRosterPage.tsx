import { useState, useEffect } from 'react';
import { useTeams } from '../../hooks/useTeam';
import { getTeamRoster } from '../../lib/db-queries';
import CoachLayout from '../../components/layouts/CoachLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import AddPlayerModal from '../../components/roster/AddPlayerModal';
import PlayerRow from '../../components/roster/PlayerRow';
import PlayerAdvancementModal from '../../components/roster/PlayerAdvancementModal';

export default function MyRosterPage() {
  const { teams, isLoading: teamLoading } = useTeams();
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [advancingPlayer, setAdvancingPlayer] = useState<any>(null);

  const currentTeam = teams[selectedTeamIndex];

  const fetchRoster = async () => {
    if (!currentTeam) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getTeamRoster(currentTeam.id);
      setPlayers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roster');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentTeam) {
      fetchRoster();
    }
  }, [currentTeam?.id]);

  if (teamLoading || isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

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
        <h1 className="text-3xl font-bold text-gray-900">My Roster</h1>

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

        {/* Add Player Button */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">{currentTeam.name}</h2>
          <button
            onClick={() => setShowAddPlayerModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            + Add Player
          </button>
        </div>

        {/* Roster Table */}
        {players.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-gray-700">
              No players on your roster yet! Click "Add Player" above to get started.
            </p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MA
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ST
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AG
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PA
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AV
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Skills/Traits
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SPP
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {players.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    onUpdate={fetchRoster}
                    onAdvance={(playerId) => {
                      const p = players.find(pl => pl.id === playerId);
                      setAdvancingPlayer(p);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Player Modal */}
        {currentTeam && (
          <AddPlayerModal
            isOpen={showAddPlayerModal}
            onClose={() => setShowAddPlayerModal(false)}
            teamId={currentTeam.id}
            teamRace={currentTeam.race}
            currentPlayerCount={players.length}
            currentTreasury={currentTeam.treasury || 0}
            onPlayerAdded={() => {
              fetchRoster();
              window.location.reload();
            }}
          />
        )}

        {/* Player Advancement Modal */}
        {advancingPlayer && (
          <PlayerAdvancementModal
            isOpen={true}
            onClose={() => setAdvancingPlayer(null)}
            playerId={advancingPlayer.id}
            playerName={advancingPlayer.player_name}
            primarySkills={advancingPlayer.primary_skills || []}
            secondarySkills={advancingPlayer.secondary_skills || []}
            onAdvancementComplete={() => {
              setAdvancingPlayer(null);
              fetchRoster();
            }}
          />
        )}
      </div>
    </CoachLayout>
  );
}
