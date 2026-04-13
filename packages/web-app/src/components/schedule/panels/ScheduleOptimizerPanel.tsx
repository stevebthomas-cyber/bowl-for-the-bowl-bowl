/**
 * ScheduleOptimizerPanel Component
 *
 * Provides draggable optimization cards that can be dropped on matches, rounds, or the entire season.
 * Each optimization type has different algorithms for regenerating the schedule.
 */

import { useState } from 'react';

export type OptimizationType =
  | 'shuffle_matchups'
  | 'minimize_venues'
  | 'maximize_venues'
  | 'compact_schedule'
  | 'expand_schedule';

export interface OptimizationOption {
  id: OptimizationType;
  name: string;
  description: string;
  icon: string;
}

interface ScheduleOptimizerPanelProps {
  onOptimizationDragStart?: (optimizationType: OptimizationType) => void;
  disabled?: boolean;
}

const OPTIMIZATION_OPTIONS: OptimizationOption[] = [
  {
    id: 'shuffle_matchups',
    name: 'Shuffle Matchups',
    description: 'Randomize team pairings while respecting season rules',
    icon: '🔀',
  },
  {
    id: 'minimize_venues',
    name: 'Minimize Venues',
    description: 'Use the fewest venues possible',
    icon: '📍',
  },
  {
    id: 'maximize_venues',
    name: 'Maximize Venues',
    description: 'Spread matches across many venues for variety',
    icon: '🗺️',
  },
  {
    id: 'compact_schedule',
    name: 'Compact Schedule',
    description: 'Minimize total weeks used',
    icon: '📦',
  },
  {
    id: 'expand_schedule',
    name: 'Expand Schedule',
    description: 'Maximize schedule length using all available dates',
    icon: '📅',
  },
];

export default function ScheduleOptimizerPanel({
  onOptimizationDragStart,
  disabled = false,
}: ScheduleOptimizerPanelProps) {
  const [draggingOption, setDraggingOption] = useState<OptimizationType | null>(null);

  return (
    <div className="space-y-4 p-3">
      <div className="text-sm font-bold text-gray-900">Schedule Optimizer</div>

      {disabled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-yellow-800 text-xs">
          Optimizer disabled while preview is active
        </div>
      )}

      <div className="space-y-2">
        {OPTIMIZATION_OPTIONS.map(option => (
          <div
            key={option.id}
            draggable={!disabled}
            onDragStart={(e) => {
              if (disabled) {
                e.preventDefault();
                return;
              }
              e.dataTransfer.setData('optimizationType', option.id);
              setDraggingOption(option.id);
              onOptimizationDragStart?.(option.id);
            }}
            onDragEnd={() => {
              setDraggingOption(null);
            }}
            className={`
              p-3 border-2 rounded-lg transition-all
              ${disabled
                ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-50'
                : 'border-blue-400 bg-white cursor-move hover:border-blue-600 hover:bg-blue-50'
              }
              ${draggingOption === option.id ? 'opacity-50' : ''}
            `}
          >
            <div className="flex items-start gap-2">
              <div className="text-2xl">{option.icon}</div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-900">
                  {option.name}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {option.description}
                </div>
                {!disabled && (
                  <div className="text-xs text-blue-600 mt-2">
                    Drag to: Match, Round, or Season
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500 italic border-t border-gray-200 pt-3">
        <div className="font-semibold mb-1">How to use:</div>
        <ul className="list-disc list-inside space-y-1">
          <li>Drag to a <strong>Match</strong> to regenerate that match</li>
          <li>Drag to a <strong>Round/Week</strong> to regenerate all matches in that round</li>
          <li>Drag to the <strong>Season</strong> to regenerate the entire schedule</li>
        </ul>
      </div>
    </div>
  );
}
