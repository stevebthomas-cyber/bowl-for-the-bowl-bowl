/**
 * ScheduleViewingMode Component
 *
 * The player-facing view for schedule distribution and messaging.
 * Shows detailed match information without editing capabilities.
 */

interface Match {
  id: string;
  match_number: number;
  home_team_id?: string;
  away_team_id?: string;
  home_team?: { name: string };
  away_team?: { name: string };
  scheduled_date?: string;
  week_number?: number;
  metadata?: {
    homeSlot?: string;
    awaySlot?: string;
    matchType?: string;
  };
}

interface ScheduleViewingModeProps {
  matches: Match[];
  leagueName: string;
  seasonNumber: number;
}

export default function ScheduleViewingMode({ matches, leagueName, seasonNumber }: ScheduleViewingModeProps) {
  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Viewing Mode</h2>
        <p className="text-gray-600">
          This mode will show a player-facing view with messaging tools and distribution options.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          Coming in Phase 6 of implementation
        </p>
      </div>
    </div>
  );
}
