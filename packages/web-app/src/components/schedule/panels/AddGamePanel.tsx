/**
 * AddGamePanel Component
 *
 * Panel for adding new games to the schedule.
 * Allows adding either fixtures (counted on league record) or friendlies (not counted).
 */

import { useState } from 'react';
import { supabase } from '../../../config/supabase';

interface AddGamePanelProps {
  leagueId: string;
  seasonNumber: number;
  onGameAdded?: () => void;
}

type GameType = 'fixture' | 'friendly';

export default function AddGamePanel({ leagueId, seasonNumber, onGameAdded }: AddGamePanelProps) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4 p-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded mb-3">
          {error}
        </div>
      )}

      {/* Fixture Draggable */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('newGameType', 'fixture');
        }}
        className="border-2 border-blue-500 rounded-lg p-4 cursor-move bg-blue-50 hover:bg-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">🏈</div>
          <div>
            <div className="font-bold text-blue-900">Fixture</div>
            <div className="text-xs text-blue-700">Counted on league record</div>
          </div>
        </div>
      </div>

      {/* Friendly Draggable */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('newGameType', 'friendly');
        }}
        className="border-2 border-green-500 rounded-lg p-4 cursor-move bg-green-50 hover:bg-green-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-2xl">🤝</div>
          <div>
            <div className="font-bold text-green-900">Friendly</div>
            <div className="text-xs text-green-700">Not counted on league record</div>
          </div>
        </div>
      </div>
    </div>
  );
}
