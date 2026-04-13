/**
 * ScheduleManagementView Component
 *
 * Main view when a schedule exists - shows calendar with management tools.
 * This will eventually include toolbar, filtering, sorting, and drag-and-drop.
 */

import ScheduleCalendarView from './ScheduleCalendarView';
import type { ScheduledMatch, ScheduleConfig } from '../../types/schedule';

interface ScheduleManagementViewProps {
  schedule: ScheduledMatch[];
  config: ScheduleConfig;
}

export default function ScheduleManagementView({ schedule, config }: ScheduleManagementViewProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Schedule Management</h2>
            <p className="text-sm text-gray-600 mt-1">
              {schedule.length} matches across {Math.max(...schedule.map(m => m.weekNumber))} periods
            </p>
          </div>
          <div className="flex gap-2">
            {/* Placeholder for future toolbar buttons */}
            <button className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              View Options
            </button>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="p-6 max-h-[800px] overflow-y-auto">
        <ScheduleCalendarView schedule={schedule} config={config} />
      </div>
    </div>
  );
}
