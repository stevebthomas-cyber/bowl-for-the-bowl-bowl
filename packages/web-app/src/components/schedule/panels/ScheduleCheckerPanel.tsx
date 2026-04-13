/**
 * ScheduleCheckerPanel Component
 *
 * Uses the advanced constraint solver to detect conflicts and generate solutions.
 * Shows draggable solution cards that can be applied to fix conflicts.
 * Clicking on an error navigates to the problem location in the schedule.
 */

import { useEffect, useState } from 'react';
import {
  ScheduleConstraintSolver,
  Conflict,
  Solution,
  Match,
  Venue,
  Team,
  Season,
  BlackoutDate,
} from '../../../utils/scheduleConstraintSolver';

interface ScheduleCheckerPanelProps {
  matches: Match[];
  venues: Venue[];
  teams: Team[];
  season: Season;
  blackoutDates?: BlackoutDate[];
  onNavigateToMatch?: (matchId: string) => void;
  onSolutionDragStart?: (solution: Solution) => void;
}

export default function ScheduleCheckerPanel({
  matches,
  venues,
  teams,
  season,
  blackoutDates = [],
  onNavigateToMatch,
  onSolutionDragStart,
}: ScheduleCheckerPanelProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [solutions, setSolutions] = useState<Map<string, Solution>>(new Map());
  const [draggingSolution, setDraggingSolution] = useState<string | null>(null);

  useEffect(() => {
    // Only run if we have all required data
    if (!matches || !venues || !teams || !season) return;

    // Run conflict detection
    const solver = new ScheduleConstraintSolver(matches, venues, teams, season, blackoutDates);
    const detectedConflicts = solver.detectConflicts();
    setConflicts(detectedConflicts);

    // Generate best solution for each conflict
    const solutionMap = new Map<string, Solution>();
    detectedConflicts.forEach(conflict => {
      const solution = solver.generateSolution(conflict);
      if (solution) {
        solutionMap.set(conflict.id, solution);
      }
    });
    setSolutions(solutionMap);
  }, [matches, venues, teams, season, blackoutDates]);

  const handleConflictClick = (conflict: Conflict) => {
    // Navigate to the first match involved in the conflict
    if (conflict.matchIds.length > 0 && onNavigateToMatch) {
      onNavigateToMatch(conflict.matchIds[0]);
    }
  };

  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');

  return (
    <div className="space-y-4 p-3">
      {/* Summary */}
      <div className="text-sm">
        {errors.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded p-3 text-green-800">
            <div className="font-semibold">✓ Schedule is valid</div>
            {warnings.length > 0 && (
              <div className="text-xs mt-1">
                {warnings.length} warning(s) - can still publish
              </div>
            )}
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800">
            <div className="font-semibold">✗ Cannot publish schedule</div>
            <div className="text-xs mt-1">
              {errors.length} error(s) must be fixed before publishing
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-red-900 mb-2">Errors ({errors.length})</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {errors.map(conflict => {
              const solution = solutions.get(conflict.id);
              return (
                <div
                  key={conflict.id}
                  className="border-2 border-red-300 rounded-lg bg-red-50"
                >
                  {/* Error description - clickable to navigate */}
                  <div
                    className="p-3 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => handleConflictClick(conflict)}
                  >
                    <div className="font-semibold text-red-900 text-sm mb-1">
                      {conflict.description}
                    </div>
                    <div className="text-xs text-red-700">{conflict.context}</div>
                  </div>

                  {/* Solution card - draggable */}
                  {solution && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('solutionId', solution.id);
                        e.dataTransfer.setData('conflictId', conflict.id);
                        setDraggingSolution(solution.id);
                        onSolutionDragStart?.(solution);
                      }}
                      onDragEnd={() => {
                        setDraggingSolution(null);
                      }}
                      className={`mx-2 mb-2 p-2 bg-white border-2 border-blue-400 rounded cursor-move hover:border-blue-600 hover:bg-blue-50 transition-colors ${
                        draggingSolution === solution.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-lg">💡</div>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-blue-900">
                            Suggested Fix
                          </div>
                          <div className="text-xs text-blue-700">
                            {solution.description}
                          </div>
                          {solution.createsNewConflicts && (
                            <div className="text-xs text-orange-600 mt-1">
                              ⚠️ May create {solution.newConflictsCount} new conflict(s)
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Drag to apply
                        </div>
                      </div>
                    </div>
                  )}

                  {!solution && (
                    <div className="mx-2 mb-2 p-2 bg-gray-100 border border-gray-300 rounded text-xs text-gray-600 italic">
                      No automatic solution available
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-yellow-900 mb-2">
            Warnings ({warnings.length})
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {warnings.map(conflict => {
              const solution = solutions.get(conflict.id);
              return (
                <div
                  key={conflict.id}
                  className="border-2 border-yellow-300 rounded-lg bg-yellow-50"
                >
                  {/* Warning description - clickable to navigate */}
                  <div
                    className="p-3 cursor-pointer hover:bg-yellow-100 transition-colors"
                    onClick={() => handleConflictClick(conflict)}
                  >
                    <div className="font-semibold text-yellow-900 text-sm mb-1">
                      {conflict.description}
                    </div>
                    <div className="text-xs text-yellow-700">{conflict.context}</div>
                  </div>

                  {/* Solution card - draggable */}
                  {solution && (
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('solutionId', solution.id);
                        e.dataTransfer.setData('conflictId', conflict.id);
                        setDraggingSolution(solution.id);
                        onSolutionDragStart?.(solution);
                      }}
                      onDragEnd={() => {
                        setDraggingSolution(null);
                      }}
                      className={`mx-2 mb-2 p-2 bg-white border-2 border-blue-400 rounded cursor-move hover:border-blue-600 hover:bg-blue-50 transition-colors ${
                        draggingSolution === solution.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-lg">💡</div>
                        <div className="flex-1">
                          <div className="text-xs font-semibold text-blue-900">
                            Suggested Fix
                          </div>
                          <div className="text-xs text-blue-700">
                            {solution.description}
                          </div>
                          {solution.createsNewConflicts && (
                            <div className="text-xs text-orange-600 mt-1">
                              ⚠️ May create {solution.newConflictsCount} new conflict(s)
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Drag to apply
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All clear */}
      {errors.length === 0 && warnings.length === 0 && matches.length > 0 && (
        <div className="text-sm text-gray-500 italic text-center py-4">
          No issues found. Schedule is ready to publish!
        </div>
      )}
    </div>
  );
}
