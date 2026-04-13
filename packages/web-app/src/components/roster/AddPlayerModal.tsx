import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { getRosterPositions } from '../../lib/roster-queries';
import { RosterPosition, STAFF_LIMITS } from '../../types/roster';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamRace: string;
  currentPlayerCount: number;
  currentTreasury: number;
  onPlayerAdded: () => void;
}

export default function AddPlayerModal({
  isOpen,
  onClose,
  teamId,
  teamRace,
  currentPlayerCount,
  currentTreasury,
  onPlayerAdded,
}: AddPlayerModalProps) {
  const [positions, setPositions] = useState<RosterPosition[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<RosterPosition | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionCounts, setPositionCounts] = useState<Record<string, number>>({});
  const [usedJerseyNumbers, setUsedJerseyNumbers] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadPositionsAndCounts();
    }
  }, [isOpen, teamId, teamRace]);

  const loadPositionsAndCounts = async () => {
    try {
      setError(null);

      // Get roster template for this race
      const { data: template, error: templateError } = await supabase
        .from('roster_templates')
        .select('id')
        .eq('team_name', teamRace)
        .maybeSingle();

      if (templateError) throw templateError;
      if (!template) throw new Error('Roster template not found for this race');

      // Get available positions
      const rosterPositions = await getRosterPositions(template.id);
      setPositions(rosterPositions);

      // Count existing players by position
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('position, number')
        .eq('team_id', teamId)
        .eq('status', 'active');

      if (playersError) throw playersError;

      // Build position counts
      const counts: Record<string, number> = {};
      const jerseyNums: number[] = [];

      (players || []).forEach((player) => {
        counts[player.position] = (counts[player.position] || 0) + 1;
        if (player.number) {
          jerseyNums.push(player.number);
        }
      });

      setPositionCounts(counts);
      setUsedJerseyNumbers(jerseyNums);

      // Suggest next available jersey number
      let suggestedNumber = 1;
      while (jerseyNums.includes(suggestedNumber)) {
        suggestedNumber++;
      }
      setJerseyNumber(suggestedNumber);

    } catch (err) {
      console.error('Error loading positions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load positions');
    }
  };

  const handlePositionSelect = (position: RosterPosition) => {
    setSelectedPosition(position);
    setPlayerName(`${position.position_name} ${(positionCounts[position.position_name] || 0) + 1}`);
  };

  const canAddPosition = (position: RosterPosition): boolean => {
    const currentCount = positionCounts[position.position_name] || 0;
    return currentCount < position.max_quantity;
  };

  const handleAddPlayer = async () => {
    if (!selectedPosition || !playerName.trim() || jerseyNumber === '') {
      setError('Please fill in all fields');
      return;
    }

    if (currentPlayerCount >= STAFF_LIMITS.MAX_PLAYERS_STANDARD) {
      setError(`Cannot exceed ${STAFF_LIMITS.MAX_PLAYERS_STANDARD} players on roster`);
      return;
    }

    if (currentTreasury < selectedPosition.cost) {
      setError('Insufficient treasury to purchase this player');
      return;
    }

    if (usedJerseyNumbers.includes(Number(jerseyNumber))) {
      setError('This jersey number is already in use');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get league season number AND current treasury (to avoid stale data)
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('league_id, treasury, leagues!teams_league_id_fkey(season_number)')
        .eq('id', teamId)
        .single();

      if (teamError) throw teamError;

      const seasonNumber = (team.leagues as any)?.season_number || 1;
      const actualCurrentTreasury = team.treasury || 0;

      // Validate treasury with fresh data
      if (actualCurrentTreasury < selectedPosition.cost) {
        setError('Insufficient treasury to purchase this player (treasury may have changed)');
        setIsLoading(false);
        return;
      }

      // Insert player
      const { error: insertError } = await supabase
        .from('players')
        .insert({
          team_id: teamId,
          name: playerName.trim(),
          number: Number(jerseyNumber),
          position: selectedPosition.position_name,
          movement: selectedPosition.ma,
          strength: selectedPosition.st,
          agility: selectedPosition.ag,
          passing: selectedPosition.pa,
          armor_value: selectedPosition.av,
          skills: selectedPosition.skills || [],
          player_value: selectedPosition.cost,
          season_joined: seasonNumber,
          status: 'active',
        });

      if (insertError) {
        console.error('Insert error details:', insertError);
        throw new Error(`Failed to insert player: ${insertError.message || JSON.stringify(insertError)}`);
      }

      // Deduct cost from treasury using atomic decrement
      // This ensures concurrent purchases don't cause race conditions
      const { data: newTreasury, error: treasuryError } = await supabase.rpc('decrement_treasury', {
        p_team_id: teamId,
        p_amount: selectedPosition.cost
      });

      if (treasuryError) {
        console.error('Treasury error details:', treasuryError);
        throw new Error(`Failed to update treasury: ${treasuryError.message || JSON.stringify(treasuryError)}`);
      }

      // Success!
      onPlayerAdded();
      onClose();
      resetForm();
    } catch (err) {
      console.error('Error adding player:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(`Failed to add player: ${JSON.stringify(err)}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedPosition(null);
    setPlayerName('');
    setJerseyNumber('');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Player</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Roster Status */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Players:</span> {currentPlayerCount}/{STAFF_LIMITS.MAX_PLAYERS_STANDARD}
              </div>
              <div>
                <span className="font-semibold">Treasury:</span> {(currentTreasury / 1000).toFixed(0)}k
              </div>
            </div>
          </div>

          {/* Select Position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Position
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded p-2">
              {positions.map((position) => {
                const currentCount = positionCounts[position.position_name] || 0;
                const canAdd = canAddPosition(position);
                const canAfford = currentTreasury >= position.cost;
                const isSelected = selectedPosition?.id === position.id;

                return (
                  <button
                    key={position.id}
                    onClick={() => canAdd && canAfford && handlePositionSelect(position)}
                    disabled={!canAdd || !canAfford}
                    className={`w-full text-left p-3 rounded transition-colors ${
                      isSelected
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : canAdd && canAfford
                        ? 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                        : 'bg-gray-100 opacity-50 cursor-not-allowed border border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {position.position_name}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {position.ma} MA | {position.st} ST | {position.ag}+ AG
                          {position.pa && ` | ${position.pa}+ PA`} | {position.av}+ AV
                        </div>
                        {position.skills.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {position.skills.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-gray-900">
                          {(position.cost / 1000).toFixed(0)}k
                        </div>
                        <div className="text-xs text-gray-600">
                          {currentCount}/{position.max_quantity}
                        </div>
                      </div>
                    </div>
                    {!canAdd && (
                      <div className="text-xs text-red-600 mt-1">
                        Maximum reached
                      </div>
                    )}
                    {!canAfford && canAdd && (
                      <div className="text-xs text-red-600 mt-1">
                        Cannot afford
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Player Details */}
          {selectedPosition && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Player Name
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter player name..."
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jersey Number
                </label>
                <input
                  type="number"
                  value={jerseyNumber}
                  onChange={(e) => setJerseyNumber(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter jersey number..."
                  min={1}
                  max={99}
                />
              </div>

              <div className="bg-gray-50 p-4 rounded">
                <div className="text-sm text-gray-700">
                  <div className="font-semibold mb-2">Purchase Summary:</div>
                  <div>Position: {selectedPosition.position_name}</div>
                  <div>Cost: {(selectedPosition.cost / 1000).toFixed(0)}k</div>
                  <div>Treasury after purchase: {((currentTreasury - selectedPosition.cost) / 1000).toFixed(0)}k</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAddPlayer}
            disabled={isLoading || !selectedPosition || !playerName.trim() || jerseyNumber === ''}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Adding Player...' : 'Add Player'}
          </button>
        </div>
      </div>
    </div>
  );
}
