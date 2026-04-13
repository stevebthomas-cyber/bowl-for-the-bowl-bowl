/**
 * Enhanced Player Card Component
 * Displays player with injury status, SPP progress, and advancement indicators
 */

import { useState } from 'react';
import SkillTooltip from '../common/SkillTooltip';

interface PlayerCardProps {
  player: {
    id: string;
    player_name: string;
    player_number: number | null;
    position_name: string;
    ma: number;
    st: number;
    ag: number;
    pa: number | null;
    av: number;
    skills: string[];
    traits: string[];
    value: number;
    spp: number;
    spp_spent: number;
    player_level: string;
    status: 'active' | 'injured' | 'dead' | 'retired';
    miss_next_game: boolean;
    niggling_injuries: number;
    injuries: string[];
    is_journeyman: boolean;
    advancements_count: number;
  };
  onViewDetails?: (playerId: string) => void;
  onAdvance?: (playerId: string) => void;
}

export default function PlayerCard({ player, onViewDetails, onAdvance }: PlayerCardProps) {
  const [showFullSkills, setShowFullSkills] = useState(false);

  const unspentSPP = player.spp - player.spp_spent;
  const canAdvance = unspentSPP >= 3; // Minimum advancement cost

  // Status badge color
  const getStatusColor = () => {
    if (player.status === 'dead') return 'bg-black text-white';
    if (player.status === 'retired') return 'bg-gray-500 text-white';
    if (player.miss_next_game) return 'bg-red-500 text-white';
    if (player.status === 'injured') return 'bg-yellow-500 text-white';
    if (player.is_journeyman) return 'bg-purple-500 text-white';
    return 'bg-green-500 text-white';
  };

  const getStatusText = () => {
    if (player.status === 'dead') return 'DEAD';
    if (player.status === 'retired') return 'RETIRED';
    if (player.miss_next_game) return 'MISS NEXT GAME';
    if (player.is_journeyman) return 'JOURNEYMAN';
    if (player.status === 'injured') return 'INJURED';
    return 'ACTIVE';
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 border-2 ${
      player.status === 'dead' ? 'border-black opacity-60' :
      player.miss_next_game ? 'border-red-400' :
      player.is_journeyman ? 'border-purple-400' :
      'border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-800">
              {player.player_number ? `#${player.player_number}` : 'J'}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {player.player_name}
              </h3>
              <p className="text-sm text-gray-600">{player.position_name}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          {player.niggling_injuries > 0 && (
            <span className="px-2 py-1 rounded text-xs font-bold bg-orange-500 text-white">
              {player.niggling_injuries} NIGGLING
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <div className="text-center">
          <div className="text-xs text-gray-600">MA</div>
          <div className="text-lg font-bold">{player.ma}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600">ST</div>
          <div className="text-lg font-bold">{player.st}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600">AG</div>
          <div className="text-lg font-bold">{player.ag}+</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600">PA</div>
          <div className="text-lg font-bold">{player.pa ? `${player.pa}+` : '-'}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-600">AV</div>
          <div className="text-lg font-bold">{player.av}+</div>
        </div>
      </div>

      {/* Skills & Traits */}
      <div className="mb-3">
        <div className="text-xs text-gray-600 mb-1">Skills & Traits</div>
        <div className="flex flex-wrap gap-1">
          {[...player.skills, ...player.traits].slice(0, showFullSkills ? undefined : 4).map((skill, idx) => (
            <SkillTooltip key={idx} skill={skill}>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {skill}
              </span>
            </SkillTooltip>
          ))}
          {[...player.skills, ...player.traits].length > 4 && !showFullSkills && (
            <button
              onClick={() => setShowFullSkills(true)}
              className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200"
            >
              +{[...player.skills, ...player.traits].length - 4} more
            </button>
          )}
        </div>
      </div>

      {/* SPP Progress */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-600">SPP Progress</span>
          <span className="text-xs font-semibold text-gray-800">
            {player.spp} total ({unspentSPP} unspent)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full"
            style={{ width: `${Math.min((unspentSPP / 6) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-600">{player.player_level}</span>
          {canAdvance && (
            <span className="text-xs font-bold text-green-600">CAN ADVANCE!</span>
          )}
        </div>
      </div>

      {/* Injuries List */}
      {player.injuries && player.injuries.length > 0 && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
          <div className="text-xs font-semibold text-red-800 mb-1">Injuries:</div>
          <div className="text-xs text-red-700">
            {player.injuries.join(', ')}
          </div>
        </div>
      )}

      {/* Value & Actions */}
      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
        <div className="text-sm">
          <span className="text-gray-600">Value:</span>
          <span className="font-bold text-gray-900 ml-1">
            {(player.value / 1000).toFixed(0)}k
          </span>
        </div>
        <div className="flex gap-2">
          {canAdvance && onAdvance && player.status === 'active' && (
            <button
              onClick={() => onAdvance(player.id)}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700"
            >
              Advance
            </button>
          )}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(player.id)}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700"
            >
              Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
