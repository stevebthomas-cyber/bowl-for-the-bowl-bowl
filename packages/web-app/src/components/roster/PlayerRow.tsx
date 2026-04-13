/**
 * Expandable Player Row Component
 * Shows player in table row, expands to show full details and edit options inline
 */

import { useState } from 'react';
import { supabase } from '../../config/supabase';
import SkillTooltip from '../common/SkillTooltip';

interface PlayerRowProps {
  player: any;
  onUpdate: () => void;
  onAdvance?: (playerId: string) => void;
}

export default function PlayerRow({ player, onUpdate, onAdvance }: PlayerRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(player.name || '');
  const [editNumber, setEditNumber] = useState(player.number || '');
  const [editingCharacteristics, setEditingCharacteristics] = useState(false);
  const [editMA, setEditMA] = useState(player.movement || 0);
  const [editST, setEditST] = useState(player.strength || 0);
  const [editAG, setEditAG] = useState(player.agility || 0);
  const [editPA, setEditPA] = useState(player.passing || 0);
  const [editAV, setEditAV] = useState(player.armor_value || 0);

  const unspentSPP = (player.spp || 0) - (player.spp_spent || 0);
  const canAdvance = unspentSPP >= 3;

  const getStatusBadge = () => {
    if (player.status === 'dead') {
      return <span className="px-2 py-1 text-xs font-bold bg-black text-white rounded">DEAD</span>;
    }
    if (player.status === 'retired') {
      return <span className="px-2 py-1 text-xs font-bold bg-gray-500 text-white rounded">RETIRED</span>;
    }
    if (player.miss_next_game) {
      return <span className="px-2 py-1 text-xs font-bold bg-red-500 text-white rounded">MISS NEXT</span>;
    }
    if (player.is_journeyman) {
      return <span className="px-2 py-1 text-xs font-bold bg-purple-500 text-white rounded">JOURNEYMAN</span>;
    }
    return null;
  };

  const handleSetMissNextGame = async (value: boolean) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ miss_next_game: value })
        .eq('id', player.id);

      if (error) throw error;
      onUpdate(); // Refresh the roster
    } catch (err) {
      console.error('Failed to update miss next game:', err);
    }
  };

  const handleAddNigglingInjury = async () => {
    try {
      const newCount = (player.niggling_injuries || 0) + 1;
      const { error } = await supabase
        .from('players')
        .update({ niggling_injuries: newCount })
        .eq('id', player.id);

      if (error) throw error;
      onUpdate(); // Refresh the roster
    } catch (err) {
      console.error('Failed to add niggling injury:', err);
    }
  };

  const handleSaveCharacteristics = async () => {
    try {
      // Track which characteristics were modified
      const modifiedChars: string[] = [];
      if (editMA !== player.movement) modifiedChars.push('MA');
      if (editST !== player.strength) modifiedChars.push('ST');
      if (editAG !== player.agility) modifiedChars.push('AG');
      if (editPA !== (player.passing || 0)) modifiedChars.push('PA');
      if (editAV !== player.armor_value) modifiedChars.push('AV');

      // Merge with existing modified_characteristics
      const existingMods = player.modified_characteristics || [];
      const allMods = [...new Set([...existingMods, ...modifiedChars])];

      const { error } = await supabase
        .from('players')
        .update({
          movement: editMA,
          strength: editST,
          agility: editAG,
          passing: editPA,
          armor_value: editAV,
          modified_characteristics: allMods
        })
        .eq('id', player.id);

      if (error) throw error;
      setEditingCharacteristics(false);
      onUpdate(); // Refresh the roster
    } catch (err) {
      console.error('Failed to save characteristics:', err);
    }
  };

  const handleMarkAsDead = async () => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ status: 'dead' })
        .eq('id', player.id);

      if (error) throw error;
      onUpdate(); // Refresh the roster
    } catch (err) {
      console.error('Failed to mark player as dead:', err);
    }
  };

  return (
    <>
      {/* Main Row */}
      <tr
        className={`${
          player.status === 'dead' ? 'bg-gray-200 opacity-50' :
          player.status === 'retired' ? 'bg-gray-200 opacity-50' :
          player.miss_next_game ? 'bg-gray-200 opacity-60' :
          player.is_journeyman ? 'bg-purple-50' :
          'hover:bg-gray-50'
        } cursor-pointer transition-colors`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">{expanded ? '▼' : '▶'}</span>
            <span className="text-sm font-medium text-gray-900">
              {player.number || 'J'}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{player.name}</span>
            {getStatusBadge()}
            {player.niggling_injuries > 0 && (
              <span className="px-2 py-1 text-xs font-bold bg-orange-500 text-white rounded">
                {player.niggling_injuries}× NIG
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            <span>{player.player_level || 'Rookie'} </span>
            {player.position}
          </div>
        </td>
        <td className="px-4 py-3 text-center text-sm">
          {player.movement}
          {player.modified_characteristics?.includes('MA') && <span className="ml-1">🩹</span>}
        </td>
        <td className="px-4 py-3 text-center text-sm">
          {player.strength}
          {player.modified_characteristics?.includes('ST') && <span className="ml-1">🩹</span>}
        </td>
        <td className="px-4 py-3 text-center text-sm">
          {player.agility}+
          {player.modified_characteristics?.includes('AG') && <span className="ml-1">🩹</span>}
        </td>
        <td className="px-4 py-3 text-center text-sm">
          {player.passing ? `${player.passing}+` : '-'}
          {player.modified_characteristics?.includes('PA') && <span className="ml-1">🩹</span>}
        </td>
        <td className="px-4 py-3 text-center text-sm">
          {player.armor_value}+
          {player.modified_characteristics?.includes('AV') && <span className="ml-1">🩹</span>}
        </td>
        <td className="px-4 py-3">
          <div className="text-sm text-gray-900 leading-relaxed max-w-xs">
            {(player.skills || []).join(', ')}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="text-sm font-semibold">
            {player.spp || 0}
            {canAdvance && <span className="text-green-600 ml-1">★</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-center text-sm">
          {(player.player_value / 1000).toFixed(0)}k
        </td>
      </tr>

      {/* Expanded Details Row */}
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={11} className="px-4 py-4">
            <div className="grid grid-cols-12 gap-4">
              {/* Left Column - Edit Name/Number */}
              <div className="col-span-3 space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-gray-900">Edit Name/Number</h4>
                    {!editing && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(true);
                        }}
                        className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editing ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Number</label>
                        <input
                          type="number"
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Save changes
                            setEditing(false);
                          }}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(false);
                            setEditName(player.name);
                            setEditNumber(player.number);
                          }}
                          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-semibold">{player.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Number:</span>
                        <span className="font-semibold">{player.number || 'N/A'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Middle-Left Column - SPP & Advancement */}
              <div className="col-span-3 space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="font-bold text-gray-900 mb-3">Experience</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total SPP:</span>
                      <span className="font-bold text-blue-600">{player.spp || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Spent:</span>
                      <span className="font-semibold">{player.spp_spent || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Unspent:</span>
                      <span className="font-bold text-green-600">{unspentSPP}</span>
                    </div>
                    {canAdvance && player.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAdvance?.(player.id);
                        }}
                        className="mt-2 w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-semibold"
                      >
                        🎲 Spend SPP (Advance)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle-Right Column - Career Stats */}
              <div className="col-span-3 space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="font-bold text-gray-900 mb-3">Career Stats</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">TDs:</span>
                      <span className="font-semibold">{player.touchdowns || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Cas:</span>
                      <span className="font-semibold">{player.casualties || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Comp:</span>
                      <span className="font-semibold">{player.completions || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Int:</span>
                      <span className="font-semibold">{player.interceptions || 0}</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-gray-600">MVPs:</span>
                      <span className="font-semibold">{player.mvp_awards || 0}</span>
                    </div>
                    {player.superb_throws > 0 && (
                      <div className="flex justify-between col-span-2">
                        <span className="text-gray-600">Superb Throws:</span>
                        <span className="font-semibold">{player.superb_throws}</span>
                      </div>
                    )}
                    {player.successful_landings > 0 && (
                      <div className="flex justify-between col-span-2">
                        <span className="text-gray-600">Landings:</span>
                        <span className="font-semibold">{player.successful_landings}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Injuries */}
                {player.injury_details && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-bold text-red-900 mb-2">Injury Details</h4>
                    <div className="text-sm text-red-700">
                      {player.injury_details}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Injury Management */}
              <div className="col-span-3 space-y-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h4 className="font-bold text-gray-900 mb-3">Injury Management</h4>
                  <div className="space-y-2">
                    {/* Miss Next Game Toggle */}
                    {player.status === 'active' && !player.miss_next_game && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetMissNextGame(true);
                        }}
                        className="w-full px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                      >
                        ⚠️ Set Miss Next Game
                      </button>
                    )}
                    {player.miss_next_game && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetMissNextGame(false);
                        }}
                        className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        ✓ Clear Miss Next Game
                      </button>
                    )}

                    {/* Add Niggling Injury */}
                    {player.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddNigglingInjury();
                        }}
                        className="w-full px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
                      >
                        ➕ Add Niggling Injury
                      </button>
                    )}

                    {/* Apply Lasting Injury (Edit Characteristics) */}
                    {player.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCharacteristics(!editingCharacteristics);
                          if (!editingCharacteristics) {
                            setEditMA(player.movement || 0);
                            setEditST(player.strength || 0);
                            setEditAG(player.agility || 0);
                            setEditPA(player.passing || 0);
                            setEditAV(player.armor_value || 0);
                          }
                        }}
                        className="w-full px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                      >
                        {editingCharacteristics ? '✖ Cancel Edit' : '🩹 Lasting Injury (Edit Stats)'}
                      </button>
                    )}

                    {/* Characteristic Editing */}
                    {editingCharacteristics && (
                      <div className="mt-2 p-2 bg-gray-50 rounded space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-gray-600">MA:</label>
                            <input
                              type="number"
                              value={editMA}
                              onChange={(e) => setEditMA(parseInt(e.target.value))}
                              className="w-full px-2 py-1 border rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600">ST:</label>
                            <input
                              type="number"
                              value={editST}
                              onChange={(e) => setEditST(parseInt(e.target.value))}
                              className="w-full px-2 py-1 border rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600">AG:</label>
                            <input
                              type="number"
                              value={editAG}
                              onChange={(e) => setEditAG(parseInt(e.target.value))}
                              className="w-full px-2 py-1 border rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <label className="block text-gray-600">PA:</label>
                            <input
                              type="number"
                              value={editPA}
                              onChange={(e) => setEditPA(parseInt(e.target.value))}
                              className="w-full px-2 py-1 border rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-gray-600">AV:</label>
                            <input
                              type="number"
                              value={editAV}
                              onChange={(e) => setEditAV(parseInt(e.target.value))}
                              className="w-full px-2 py-1 border rounded"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveCharacteristics();
                          }}
                          className="w-full px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Save Changes
                        </button>
                      </div>
                    )}

                    {/* Mark as Dead */}
                    {player.status === 'active' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsDead();
                        }}
                        className="w-full px-3 py-2 bg-black text-white rounded text-sm hover:bg-gray-900"
                      >
                        ☠️ Mark as Dead
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row - Retire/Fire Actions */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              {!player.is_journeyman && player.status === 'active' && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Retire player
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Retire Player
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Fire player
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    🔥 Fire Player
                  </button>
                </>
              )}
              {player.is_journeyman && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Hire permanently
                  }}
                  className="col-span-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  💰 Hire Journeyman Permanently
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
