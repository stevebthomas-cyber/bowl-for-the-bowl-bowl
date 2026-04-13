/**
 * ScheduleCalendarView Component
 *
 * Displays schedule grouped by weeks/periods in calendar format.
 * Shows matches with team names, types, and dates.
 */

import type { ScheduledMatch, ScheduleConfig } from '../../types/schedule';

interface ScheduleCalendarViewProps {
  schedule: ScheduledMatch[];
  config: ScheduleConfig;
}

export default function ScheduleCalendarView({ schedule, config }: ScheduleCalendarViewProps) {
  if (schedule.length === 0) {
    return (
      <div className="text-center text-gray-500 py-12">
        {config.gameDays.length === 0
          ? 'Select at least one game day to generate schedule'
          : 'No matches generated. Adjust configuration to create schedule.'}
      </div>
    );
  }

  // Group matches by week
  const weeks = Array.from(new Set(schedule.map(m => m.weekNumber))).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {weeks.map(week => {
        const weekMatches = schedule.filter(m => m.weekNumber === week);
        const weekDate = weekMatches[0]?.scheduledDate;
        const isOverdue = weekDate && new Date(weekDate) > new Date(config.seasonEndDate);

        return (
          <div
            key={week}
            className={`border rounded-lg p-4 ${
              weekMatches[0]?.matchType === 'playoff' ? 'border-purple-300 bg-purple-50'
              : isOverdue ? 'border-red-300 bg-red-50'
              : 'border-gray-200'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className={`text-lg font-bold ${
                weekMatches[0]?.matchType === 'playoff' ? 'text-purple-900'
                : isOverdue ? 'text-red-900'
                : 'text-gray-900'
              }`}>
                {weekMatches[0]?.matchType === 'playoff' ? `🏆 ${weekMatches[0]?.playoffRound}` : `Period ${week}`}
                {isOverdue && weekMatches[0]?.matchType !== 'playoff' && <span className="ml-2 text-sm font-normal">(Past season end!)</span>}
              </h3>
              <span className="text-sm text-gray-600">
                {weekDate ? new Date(weekDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'No date'}
              </span>
            </div>
            <div className="space-y-2">
              {weekMatches.map(match => (
                <div
                  key={match.matchNumber}
                  className="flex items-center justify-between p-3 bg-white rounded hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs text-gray-500 w-12">#{match.matchNumber}</span>
                  <div className="flex-1 flex items-center justify-between px-4">
                    <span className={match.homeTeamName ? 'font-semibold text-gray-900' : 'italic text-gray-500'}>
                      {match.homeTeamName || `[${match.homeSlot}]`}
                    </span>
                    <span className="text-gray-500 mx-4">vs</span>
                    <span className={match.awayTeamName ? 'font-semibold text-gray-900' : 'italic text-gray-500'}>
                      {match.awayTeamName || `[${match.awaySlot}]`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 px-2 py-1 bg-gray-200 rounded">
                      {match.matchType === 'playoff' ? match.playoffRound
                        : match.matchType === 'intra-division' ? 'Intra'
                        : match.matchType === 'inter-division' ? 'Inter'
                        : match.matchType === 'pool' ? 'Pool'
                        : 'RR'}
                    </span>
                    <span className="text-sm text-gray-600">{config.defaultGameTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
