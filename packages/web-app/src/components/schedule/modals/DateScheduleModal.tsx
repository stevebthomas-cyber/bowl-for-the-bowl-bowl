/**
 * DateScheduleModal Component
 *
 * Modal for creating/editing date schedules.
 * Defines when games can be played (reusable date/time patterns).
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';
import { datetimeLocalToISO, isoToDatetimeLocal } from '../../../utils/dateUtils';

interface DateScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  seasonNumber: number;
  scheduleId?: string | null; // null for new schedule, string for editing
}

interface DateScheduleData {
  id?: string;
  name: string;
  use_specific_dates: boolean;
  availability_start_datetime: string;
  availability_end_datetime: string;
  is_recurring: boolean;
  recurrence_type: 'daily' | 'on_certain_days' | 'weekly' | 'biweekly' | 'semimonthly' | 'monthly' | 'custom' | null;
  recurrence_days: string[];
  recurrence_interval: number | null;
  recurrence_period: 'days' | 'weeks' | 'months' | null;
  specific_dates: string[];
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function DateScheduleModal({ isOpen, onClose, leagueId, seasonNumber, scheduleId }: DateScheduleModalProps) {
  const [schedule, setSchedule] = useState<DateScheduleData>({
    name: '',
    use_specific_dates: false,
    availability_start_datetime: '',
    availability_end_datetime: '',
    is_recurring: false,
    recurrence_type: null,
    recurrence_days: [],
    recurrence_interval: null,
    recurrence_period: null,
    specific_dates: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (scheduleId) {
        loadSchedule();
      } else {
        // Reset for new schedule
        setSchedule({
          name: '',
          use_specific_dates: false,
          availability_start_datetime: '',
          availability_end_datetime: '',
          is_recurring: false,
          recurrence_type: null,
          recurrence_days: [],
          recurrence_interval: null,
          recurrence_period: null,
          specific_dates: [],
        });
      }
    }
  }, [isOpen, scheduleId]);

  const loadSchedule = async () => {
    if (!scheduleId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('date_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (error) throw error;

      setSchedule({
        id: data.id,
        name: data.name,
        use_specific_dates: data.use_specific_dates || false,
        availability_start_datetime: data.availability_start_datetime || '',
        availability_end_datetime: data.availability_end_datetime || '',
        is_recurring: data.is_recurring || false,
        recurrence_type: data.recurrence_type || null,
        recurrence_days: data.recurrence_days || [],
        recurrence_interval: data.recurrence_interval || null,
        recurrence_period: data.recurrence_period || null,
        specific_dates: data.specific_dates || [],
      });
    } catch (err) {
      console.error('Error loading schedule:', err);
      alert('Failed to load schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!schedule.name.trim()) {
      alert('Schedule name is required');
      return;
    }

    setIsSaving(true);
    try {
      const scheduleData = {
        name: schedule.name,
        use_specific_dates: schedule.use_specific_dates,
        availability_start_datetime: schedule.availability_start_datetime || null,
        availability_end_datetime: schedule.availability_end_datetime || null,
        is_recurring: schedule.is_recurring,
        recurrence_type: schedule.recurrence_type,
        recurrence_days: schedule.recurrence_days.length > 0 ? schedule.recurrence_days : null,
        recurrence_interval: schedule.recurrence_interval,
        recurrence_period: schedule.recurrence_period,
        specific_dates: schedule.specific_dates.length > 0 ? schedule.specific_dates : null,
      };

      if (scheduleId) {
        // Update existing
        const { error } = await supabase
          .from('date_schedules')
          .update(scheduleData)
          .eq('id', scheduleId);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('date_schedules')
          .insert({
            league_id: leagueId,
            season_number: seasonNumber,
            ...scheduleData,
          });

        if (error) throw error;
      }

      onClose();
    } catch (err) {
      console.error('Error saving schedule:', err);
      alert('Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRecurrenceDay = (day: string) => {
    const newDays = schedule.recurrence_days.includes(day)
      ? schedule.recurrence_days.filter(d => d !== day)
      : [...schedule.recurrence_days, day];
    setSchedule({ ...schedule, recurrence_days: newDays });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {scheduleId ? 'Edit Date Schedule' : 'Add Date Schedule'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Schedule Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Schedule Name *
                </label>
                <input
                  type="text"
                  value={schedule.name}
                  onChange={(e) => setSchedule({ ...schedule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Regular Season, Tuesday Night Games"
                />
              </div>

              {/* Availability Mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Availability Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!schedule.use_specific_dates}
                      onChange={() => {
                        setSchedule({ ...schedule, use_specific_dates: false });
                      }}
                    />
                    <span className="text-sm">Time Range with Recurrence</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={schedule.use_specific_dates}
                      onChange={() => {
                        setSchedule({ ...schedule, use_specific_dates: true });
                      }}
                    />
                    <span className="text-sm">Specific Dates (Calendar Picker)</span>
                  </label>
                </div>
              </div>

              {/* Recurring Availability Mode */}
              {!schedule.use_specific_dates && (
                <div className="border-t pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date/Time</label>
                      <input
                        type="datetime-local"
                        value={isoToDatetimeLocal(schedule.availability_start_datetime)}
                        onChange={(e) => setSchedule({
                          ...schedule,
                          availability_start_datetime: datetimeLocalToISO(e.target.value),
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">End Date/Time</label>
                      <input
                        type="datetime-local"
                        value={isoToDatetimeLocal(schedule.availability_end_datetime)}
                        onChange={(e) => setSchedule({
                          ...schedule,
                          availability_end_datetime: datetimeLocalToISO(e.target.value),
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {/* Make Recurring Checkbox */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schedule.is_recurring}
                        onChange={(e) => setSchedule({ ...schedule, is_recurring: e.target.checked })}
                      />
                      <span className="text-sm font-medium">Make this recurring</span>
                    </label>
                  </div>

                  {/* Recurrence Options */}
                  {schedule.is_recurring && (
                    <div className="pl-6 space-y-3 border-l-2 border-blue-200">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Recurrence Pattern</label>
                        <select
                          value={schedule.recurrence_type || ''}
                          onChange={(e) => setSchedule({ ...schedule, recurrence_type: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">Select pattern...</option>
                          <option value="daily">Daily</option>
                          <option value="on_certain_days">On certain days</option>
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Biweekly</option>
                          <option value="semimonthly">Semi-monthly</option>
                          <option value="monthly">Monthly</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      {/* On Certain Days - Day Checkboxes */}
                      {schedule.recurrence_type === 'on_certain_days' && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Days</label>
                          <div className="grid grid-cols-2 gap-2">
                            {DAYS_OF_WEEK.map((day) => (
                              <label key={day} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={schedule.recurrence_days.includes(day)}
                                  onChange={() => toggleRecurrenceDay(day)}
                                />
                                <span className="text-sm">{day}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom - Every X period */}
                      {schedule.recurrence_type === 'custom' && (
                        <div className="flex gap-2 items-center">
                          <span className="text-sm">Every</span>
                          <input
                            type="number"
                            min="1"
                            value={schedule.recurrence_interval || ''}
                            onChange={(e) => setSchedule({ ...schedule, recurrence_interval: parseInt(e.target.value) || null })}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="1"
                          />
                          <select
                            value={schedule.recurrence_period || ''}
                            onChange={(e) => setSchedule({ ...schedule, recurrence_period: e.target.value as any })}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="">Select...</option>
                            <option value="days">Days</option>
                            <option value="weeks">Weeks</option>
                            <option value="months">Months</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Specific Dates Mode */}
              {schedule.use_specific_dates && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Specific Dates
                  </label>
                  <p className="text-sm text-gray-500 italic">
                    Calendar picker UI coming soon
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={onClose}
                  disabled={isSaving}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
