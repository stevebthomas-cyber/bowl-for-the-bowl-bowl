/**
 * DatesPanel Component
 *
 * Displays list of date schedules that define when games can be played.
 * Click to edit, displayed inline in the right sidebar.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';
import DateScheduleModal from '../modals/DateScheduleModal';
import BlackoutDateModal from '../modals/BlackoutDateModal';

interface DateSchedule {
  id: string;
  name: string;
  use_specific_dates: boolean;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_days: string[] | null;
  recurrence_interval: number | null;
  recurrence_period: string | null;
  availability_start_datetime: string | null;
  availability_end_datetime: string | null;
  specific_dates: string[] | null;
}

interface BlackoutDate {
  id: string;
  name: string;
  applies_to: 'league' | 'venues' | 'pitches';
  venue_ids: string[] | null;
  pitch_ids: string[] | null;
  blackout_type: 'single_date' | 'date_range' | 'recurring' | 'holiday' | 'holiday_weekend';
  start_date: string | null;
  end_date: string | null;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_days: string[] | null;
  recurrence_interval: number | null;
  recurrence_period: string | null;
  holiday_type: string | null;
  include_weekend: boolean;
  notes: string | null;
}

interface DatesPanelProps {
  leagueId: string;
  seasonNumber: number;
}

export default function DatesPanel({ leagueId, seasonNumber }: DatesPanelProps) {
  const [schedules, setSchedules] = useState<DateSchedule[]>([]);
  const [blackouts, setBlackouts] = useState<BlackoutDate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [isBlackoutModalOpen, setIsBlackoutModalOpen] = useState(false);
  const [editingBlackoutId, setEditingBlackoutId] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
    loadBlackouts();
  }, [leagueId, seasonNumber]);

  const loadSchedules = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('date_schedules')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .order('name');

      if (error) throw error;

      setSchedules(data || []);
    } catch (err) {
      console.error('Error loading date schedules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBlackouts = async () => {
    try {
      const { data, error } = await supabase
        .from('blackout_dates')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .order('name');

      if (error) throw error;

      setBlackouts(data || []);
    } catch (err) {
      console.error('Error loading blackout dates:', err);
    }
  };

  const handleScheduleClick = (scheduleId: string) => {
    setEditingScheduleId(scheduleId);
    setIsModalOpen(true);
  };

  const handleAddSchedule = () => {
    setEditingScheduleId(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingScheduleId(null);
    loadSchedules(); // Reload schedules after modal closes
  };

  const handleAddBlackout = () => {
    setEditingBlackoutId(null);
    setIsBlackoutModalOpen(true);
  };

  const handleBlackoutClick = (blackoutId: string) => {
    setEditingBlackoutId(blackoutId);
    setIsBlackoutModalOpen(true);
  };

  const handleBlackoutModalClose = () => {
    setIsBlackoutModalOpen(false);
    setEditingBlackoutId(null);
    loadBlackouts(); // Reload blackouts after modal closes
  };

  const getScheduleSummary = (schedule: DateSchedule): string => {
    if (schedule.use_specific_dates) {
      return 'Specific dates';
    }
    if (schedule.is_recurring && schedule.recurrence_type) {
      return `Recurring: ${schedule.recurrence_type.replace('_', ' ')}`;
    }
    if (schedule.availability_start_datetime) {
      const start = new Date(schedule.availability_start_datetime).toLocaleDateString();
      return `From ${start}`;
    }
    return 'Date range';
  };

  const getBlackoutSummary = (blackout: BlackoutDate): string => {
    if (blackout.blackout_type === 'holiday' || blackout.blackout_type === 'holiday_weekend') {
      const weekend = blackout.include_weekend ? ' Weekend' : '';
      return `${blackout.holiday_type}${weekend}`;
    }
    if (blackout.blackout_type === 'single_date' && blackout.start_date) {
      return new Date(blackout.start_date).toLocaleDateString();
    }
    if (blackout.blackout_type === 'date_range' && blackout.start_date && blackout.end_date) {
      const start = new Date(blackout.start_date).toLocaleDateString();
      const end = new Date(blackout.end_date).toLocaleDateString();
      return `${start} - ${end}`;
    }
    if (blackout.blackout_type === 'recurring' && blackout.recurrence_type) {
      return `Recurring: ${blackout.recurrence_type.replace('_', ' ')}`;
    }
    return blackout.applies_to === 'league' ? 'League-wide' : 'Venue-specific';
  };

  return (
    <>
      <DateScheduleModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        leagueId={leagueId}
        seasonNumber={seasonNumber}
        scheduleId={editingScheduleId}
      />

      <BlackoutDateModal
        isOpen={isBlackoutModalOpen}
        onClose={handleBlackoutModalClose}
        leagueId={leagueId}
        seasonNumber={seasonNumber}
        blackoutId={editingBlackoutId}
      />

      <div className="space-y-6">
        {/* Date Schedules Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Date Schedules</h3>

          {/* Schedules List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-4 text-sm text-gray-500">
                Loading schedules...
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">
                No date schedules found
              </div>
            ) : (
              schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="p-2 bg-gray-50 hover:bg-gray-100 cursor-move transition-colors flex items-center justify-between text-sm group rounded"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('dateScheduleId', schedule.id);
                    e.dataTransfer.setData('dateScheduleName', schedule.name);
                    e.dataTransfer.setData('dateScheduleData', JSON.stringify(schedule));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {schedule.name}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {getScheduleSummary(schedule)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScheduleClick(schedule.id);
                    }}
                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Edit
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Schedule Button */}
          <button
            onClick={handleAddSchedule}
            className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            + Add Date Schedule
          </button>
        </div>

        {/* Blackout Dates Section */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Blackout Dates</h3>

          {/* Blackouts List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {blackouts.length === 0 ? (
              <div className="text-center py-4 text-sm text-gray-500">
                No blackout dates found
              </div>
            ) : (
              blackouts.map((blackout) => (
                <div
                  key={blackout.id}
                  className="p-2 bg-red-50 hover:bg-red-100 cursor-move transition-colors flex items-center justify-between text-sm group rounded border border-red-200"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('blackoutId', blackout.id);
                    e.dataTransfer.setData('blackoutName', blackout.name);
                    e.dataTransfer.setData('blackoutData', JSON.stringify(blackout));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {blackout.name}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {getBlackoutSummary(blackout)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBlackoutClick(blackout.id);
                    }}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Edit
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Blackout Button */}
          <button
            onClick={handleAddBlackout}
            className="w-full px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            + Add Blackout Date(s)
          </button>
        </div>
      </div>
    </>
  );
}
