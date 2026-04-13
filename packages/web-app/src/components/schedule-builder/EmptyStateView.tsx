/**
 * EmptyStateView Component
 *
 * Displayed when no schedule has been generated yet.
 * Provides quick preset buttons for common schedule types.
 */

import type { ScheduleConfig } from '../../types/schedule';

interface EmptyStateViewProps {
  onConfigUpdate: (updates: Partial<ScheduleConfig>) => void;
}

export default function EmptyStateView({ onConfigUpdate }: EmptyStateViewProps) {
  const applyQuickRoundRobin = () => {
    onConfigUpdate({
      scheduleType: 'round-robin',
      divisionsCount: 1,
      teamsPerDivision: 8,
      gameDays: [3], // Wednesday
      matchesPerDay: 4,
      includePlayoffs: false,
      playoffFormat: 'none'
    });
  };

  const applyDivisionalLeague = () => {
    onConfigUpdate({
      scheduleType: 'divisional',
      divisionsCount: 2,
      teamsPerDivision: 4,
      intraDivisionGames: 2,
      interDivisionGames: 1,
      gameDays: [3], // Wednesday
      matchesPerDay: 4,
      includePlayoffs: true,
      playoffFormat: 'championship'
    });
  };

  const applyPoolTournament = () => {
    onConfigUpdate({
      scheduleType: 'pool-only',
      poolsCount: 4,
      teamsPerPool: 4,
      gamesPerTeamInPool: 3,
      gameDays: [6], // Saturday
      matchesPerDay: 8,
      includePlayoffs: true,
      playoffFormat: 'top_4'
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[600px] bg-gray-50 rounded-lg">
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="mb-8">
          <div className="text-6xl mb-4">📅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Schedule Generated</h2>
          <p className="text-gray-600">
            Configure your schedule settings on the left, or choose a quick preset below to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quick Round-Robin */}
          <button
            onClick={applyQuickRoundRobin}
            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all text-left group"
          >
            <div className="text-3xl mb-3">🔄</div>
            <h3 className="font-bold text-gray-900 mb-2 group-hover:text-blue-600">Quick Round-Robin</h3>
            <p className="text-sm text-gray-600 mb-3">8 teams, everyone plays everyone once</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• 1 division, 8 teams</li>
              <li>• Wednesdays, 4 matches/day</li>
              <li>• No playoffs</li>
            </ul>
          </button>

          {/* Divisional League */}
          <button
            onClick={applyDivisionalLeague}
            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all text-left group"
          >
            <div className="text-3xl mb-3">🏆</div>
            <h3 className="font-bold text-gray-900 mb-2 group-hover:text-blue-600">Divisional League</h3>
            <p className="text-sm text-gray-600 mb-3">Classic 2-division setup with playoffs</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• 2 divisions, 4 teams each</li>
              <li>• 2x intra, 1x inter-division</li>
              <li>• Championship playoff</li>
            </ul>
          </button>

          {/* Pool Tournament */}
          <button
            onClick={applyPoolTournament}
            className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all text-left group"
          >
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-bold text-gray-900 mb-2 group-hover:text-blue-600">Pool Tournament</h3>
            <p className="text-sm text-gray-600 mb-3">16 teams in 4 pools with top-4 playoffs</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• 4 pools, 4 teams each</li>
              <li>• 3 games per team in pool</li>
              <li>• Top 4 bracket playoff</li>
            </ul>
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            💡 <strong>Tip:</strong> After selecting a preset, customize the settings in the configuration panel on the left.
          </p>
        </div>
      </div>
    </div>
  );
}
