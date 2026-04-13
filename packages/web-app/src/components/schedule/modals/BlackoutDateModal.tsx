/**
 * BlackoutDateModal Component
 *
 * Modal for creating/editing blackout dates.
 * Defines when games CANNOT be played.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';
import { getPublicHolidays, getAvailableCountries, Holiday, Country, COMMON_COUNTRIES } from '../../../utils/holidayApi';

interface BlackoutDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  seasonNumber: number;
  blackoutId?: string | null;
}

interface BlackoutData {
  id?: string;
  name: string;
  applies_to: 'league' | 'venues' | 'pitches';
  venue_ids: string[];
  pitch_ids: string[];
  blackout_type: 'single_date' | 'date_range' | 'recurring' | 'holiday' | 'holiday_weekend';
  start_date: string;
  end_date: string;
  is_recurring: boolean;
  recurrence_type: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'on_certain_days' | 'custom' | null;
  recurrence_days: string[];
  recurrence_interval: number | null;
  recurrence_period: 'days' | 'weeks' | 'months' | null;
  holiday_type: string;
  include_weekend: boolean;
  notes: string;
}

interface Venue {
  id: string;
  name: string;
  pitches: Array<{ id: string; name: string }>;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Parse a date string in YYYY-MM-DD format without timezone conversion
 * This prevents the date from shifting due to UTC to local timezone conversion
 * Also handles ISO 8601 format with time component (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
function parseDateWithoutTimezone(dateStr: string): Date {
  // Extract just the date part if it's an ISO 8601 string with time
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export default function BlackoutDateModal({ isOpen, onClose, leagueId, seasonNumber, blackoutId }: BlackoutDateModalProps) {
  const [blackout, setBlackout] = useState<BlackoutData>({
    name: '',
    applies_to: 'league',
    venue_ids: [],
    pitch_ids: [],
    blackout_type: 'single_date',
    start_date: '',
    end_date: '',
    is_recurring: false,
    recurrence_type: null,
    recurrence_days: [],
    recurrence_interval: null,
    recurrence_period: null,
    holiday_type: '',
    include_weekend: false,
    notes: '',
  });

  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [seasonStartDate, setSeasonStartDate] = useState<string | null>(null);

  // Holiday API state
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('US');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedHolidays, setSelectedHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadVenues();
      loadSeason();
      if (blackoutId) {
        loadBlackout();
      } else {
        // Reset for new blackout
        setBlackout({
          name: '',
          applies_to: 'league',
          venue_ids: [],
          pitch_ids: [],
          blackout_type: 'single_date',
          start_date: '',
          end_date: '',
          is_recurring: false,
          recurrence_type: null,
          recurrence_days: [],
          recurrence_interval: null,
          recurrence_period: null,
          holiday_type: '',
          include_weekend: false,
          notes: '',
        });
      }
    }
  }, [isOpen, blackoutId]);

  // Load countries on mount
  useEffect(() => {
    loadCountries();
  }, []);

  // Load holidays when country, blackout type, or season start date changes
  useEffect(() => {
    if ((blackout.blackout_type === 'holiday' || blackout.blackout_type === 'holiday_weekend') && seasonStartDate) {
      loadHolidays();
    }
  }, [selectedCountry, blackout.blackout_type, seasonStartDate]);

  const loadCountries = async () => {
    try {
      const data = await getAvailableCountries();
      setCountries(data);
    } catch (err) {
      console.error('Error loading countries:', err);
    }
  };

  const loadSeason = async () => {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('start_date')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .single();

      if (error) throw error;
      setSeasonStartDate(data?.start_date || null);
    } catch (err) {
      console.error('Error loading season:', err);
    }
  };

  const loadHolidays = async () => {
    setLoadingHolidays(true);
    try {
      // Get year from season start date, or use current year as fallback
      let year = new Date().getFullYear();
      if (seasonStartDate) {
        year = parseDateWithoutTimezone(seasonStartDate).getFullYear();
      }

      const data = await getPublicHolidays(selectedCountry, year);
      setHolidays(data);
    } catch (err) {
      console.error('Error loading holidays:', err);
      setHolidays([]);
    } finally {
      setLoadingHolidays(false);
    }
  };

  const handleHolidayToggle = (holiday: Holiday) => {
    const isSelected = selectedHolidays.some(h => h.date === holiday.date && h.name === holiday.name);

    if (isSelected) {
      // Remove from selection
      setSelectedHolidays(selectedHolidays.filter(h => !(h.date === holiday.date && h.name === holiday.name)));
    } else {
      // Add to selection
      setSelectedHolidays([...selectedHolidays, holiday]);
    }
  };

  const handleSelectAllHolidays = () => {
    setSelectedHolidays([...holidays]);
  };

  const handleClearAllHolidays = () => {
    setSelectedHolidays([]);
  };

  const loadVenues = async () => {
    try {
      const { data, error } = await supabase
        .from('venues')
        .select(`
          id,
          name,
          pitches (
            id,
            name
          )
        `)
        .eq('league_id', leagueId)
        .eq('include_in_season', true)
        .order('name');

      if (error) throw error;
      setVenues(data || []);
    } catch (err) {
      console.error('Error loading venues:', err);
    }
  };

  const loadBlackout = async () => {
    if (!blackoutId) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('blackout_dates')
        .select('*')
        .eq('id', blackoutId)
        .single();

      if (error) throw error;

      setBlackout({
        id: data.id,
        name: data.name,
        applies_to: data.applies_to || 'league',
        venue_ids: data.venue_ids || [],
        pitch_ids: data.pitch_ids || [],
        blackout_type: data.blackout_type || 'single_date',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        is_recurring: data.is_recurring || false,
        recurrence_type: data.recurrence_type || null,
        recurrence_days: data.recurrence_days || [],
        recurrence_interval: data.recurrence_interval || null,
        recurrence_period: data.recurrence_period || null,
        holiday_type: data.holiday_type || '',
        include_weekend: data.include_weekend || false,
        notes: data.notes || '',
      });
    } catch (err) {
      console.error('Error loading blackout:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // For holiday types with multiple selections, validate differently
    if (blackout.blackout_type === 'holiday' || blackout.blackout_type === 'holiday_weekend') {
      if (selectedHolidays.length === 0) {
        alert('Please select at least one holiday');
        return;
      }
    } else {
      if (!blackout.name.trim()) {
        alert('Please enter a name for this blackout');
        return;
      }
    }

    setIsSaving(true);
    try {
      // If it's a holiday type with multiple selections, create multiple records
      if ((blackout.blackout_type === 'holiday' || blackout.blackout_type === 'holiday_weekend') && selectedHolidays.length > 0) {
        const payloads = selectedHolidays.map(holiday => ({
          league_id: leagueId,
          season_number: seasonNumber,
          name: holiday.name,
          applies_to: blackout.applies_to,
          venue_ids: (blackout.applies_to === 'venues' || blackout.applies_to === 'pitches') ? blackout.venue_ids : null,
          pitch_ids: blackout.applies_to === 'pitches' ? blackout.pitch_ids : null,
          blackout_type: blackout.blackout_type,
          start_date: holiday.date,
          end_date: holiday.date,
          is_recurring: false,
          recurrence_type: null,
          recurrence_days: null,
          recurrence_interval: null,
          recurrence_period: null,
          holiday_type: holiday.name,
          include_weekend: blackout.blackout_type === 'holiday_weekend',
          notes: blackout.notes || null,
        }));

        const { error } = await supabase
          .from('blackout_dates')
          .insert(payloads);

        if (error) throw error;
      } else {
        // Single blackout (non-holiday or editing existing)
        const payload = {
          league_id: leagueId,
          season_number: seasonNumber,
          name: blackout.name,
          applies_to: blackout.applies_to,
          venue_ids: (blackout.applies_to === 'venues' || blackout.applies_to === 'pitches') ? blackout.venue_ids : null,
          pitch_ids: blackout.applies_to === 'pitches' ? blackout.pitch_ids : null,
          blackout_type: blackout.blackout_type,
          start_date: blackout.start_date || null,
          end_date: blackout.blackout_type === 'date_range' ? blackout.end_date : null,
          is_recurring: blackout.blackout_type === 'recurring',
          recurrence_type: blackout.blackout_type === 'recurring' ? blackout.recurrence_type : null,
          recurrence_days: blackout.blackout_type === 'recurring' && blackout.recurrence_type === 'on_certain_days' ? blackout.recurrence_days : null,
          recurrence_interval: blackout.blackout_type === 'recurring' && blackout.recurrence_type === 'custom' ? blackout.recurrence_interval : null,
          recurrence_period: blackout.blackout_type === 'recurring' && blackout.recurrence_type === 'custom' ? blackout.recurrence_period : null,
          holiday_type: (blackout.blackout_type === 'holiday' || blackout.blackout_type === 'holiday_weekend') ? blackout.holiday_type : null,
          include_weekend: blackout.blackout_type === 'holiday_weekend',
          notes: blackout.notes || null,
        };

        if (blackoutId) {
          const { error } = await supabase
            .from('blackout_dates')
            .update(payload)
            .eq('id', blackoutId);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('blackout_dates')
            .insert([payload]);

          if (error) throw error;
        }
      }

      onClose();
    } catch (err) {
      console.error('Error saving blackout:', err);
      alert('Failed to save blackout');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!blackoutId) return;
    if (!confirm('Are you sure you want to delete this blackout date?')) return;

    try {
      const { error } = await supabase
        .from('blackout_dates')
        .delete()
        .eq('id', blackoutId);

      if (error) throw error;
      onClose();
    } catch (err) {
      console.error('Error deleting blackout:', err);
      alert('Failed to delete blackout');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {blackoutId ? 'Edit Blackout Date' : 'Add Blackout Date'}
          </h2>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={blackout.name}
                  onChange={(e) => setBlackout({ ...blackout, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Christmas Break"
                />
              </div>

              {/* Blackout Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Blackout Type *
                </label>
                <select
                  value={blackout.blackout_type}
                  onChange={(e) => setBlackout({ ...blackout, blackout_type: e.target.value as BlackoutData['blackout_type'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="single_date">Single Date</option>
                  <option value="date_range">Date Range</option>
                  <option value="recurring">Recurring</option>
                  <option value="holiday">Holiday</option>
                  <option value="holiday_weekend">Holiday Weekend</option>
                </select>
              </div>

              {/* Single Date or Date Range */}
              {(blackout.blackout_type === 'single_date' || blackout.blackout_type === 'date_range') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {blackout.blackout_type === 'single_date' ? 'Date' : 'Start Date'} *
                    </label>
                    <input
                      type="date"
                      value={blackout.start_date}
                      onChange={(e) => setBlackout({ ...blackout, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  {blackout.blackout_type === 'date_range' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date *
                      </label>
                      <input
                        type="date"
                        value={blackout.end_date}
                        min={blackout.start_date}
                        onChange={(e) => setBlackout({ ...blackout, end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Recurring */}
              {blackout.blackout_type === 'recurring' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recurrence Pattern *
                    </label>
                    <select
                      value={blackout.recurrence_type || ''}
                      onChange={(e) => setBlackout({ ...blackout, recurrence_type: e.target.value as BlackoutData['recurrence_type'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select pattern</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="on_certain_days">On Certain Days</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  {blackout.recurrence_type === 'on_certain_days' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Days *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {DAYS_OF_WEEK.map(day => (
                          <label key={day} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={blackout.recurrence_days.includes(day)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBlackout({ ...blackout, recurrence_days: [...blackout.recurrence_days, day] });
                                } else {
                                  setBlackout({ ...blackout, recurrence_days: blackout.recurrence_days.filter(d => d !== day) });
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {blackout.recurrence_type === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Every
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={blackout.recurrence_interval || ''}
                          onChange={(e) => setBlackout({ ...blackout, recurrence_interval: parseInt(e.target.value) || null })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Period
                        </label>
                        <select
                          value={blackout.recurrence_period || ''}
                          onChange={(e) => setBlackout({ ...blackout, recurrence_period: e.target.value as BlackoutData['recurrence_period'] })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">Select</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                          <option value="months">Months</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        value={blackout.start_date}
                        onChange={(e) => setBlackout({ ...blackout, start_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date *
                      </label>
                      <input
                        type="date"
                        value={blackout.end_date}
                        min={blackout.start_date}
                        onChange={(e) => setBlackout({ ...blackout, end_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Holiday */}
              {(blackout.blackout_type === 'holiday' || blackout.blackout_type === 'holiday_weekend') && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country *
                    </label>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <optgroup label="Common Countries">
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="CA">Canada</option>
                        <option value="AU">Australia</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="IT">Italy</option>
                        <option value="ES">Spain</option>
                      </optgroup>
                      {countries.length > 0 && (
                        <optgroup label="All Countries">
                          {countries.map(country => (
                            <option key={country.countryCode} value={country.countryCode}>
                              {country.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Select Holidays * ({selectedHolidays.length} selected)
                      </label>
                      {holidays.length > 0 && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllHolidays}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={handleClearAllHolidays}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                    </div>
                    {loadingHolidays ? (
                      <div className="text-sm text-gray-500 py-2">Loading holidays...</div>
                    ) : holidays.length > 0 ? (
                      <div className="border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                        {holidays.map((holiday) => {
                          const isSelected = selectedHolidays.some(h => h.date === holiday.date && h.name === holiday.name);
                          return (
                            <label
                              key={holiday.date + holiday.name}
                              className={`flex items-start gap-3 px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-200 last:border-b-0 cursor-pointer ${
                                isSelected ? 'bg-blue-50' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleHolidayToggle(holiday)}
                                className="mt-1 rounded"
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-sm">{holiday.name}</div>
                                <div className="text-xs text-gray-600">
                                  {parseDateWithoutTimezone(holiday.date).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </div>
                                {holiday.localName !== holiday.name && (
                                  <div className="text-xs text-gray-500 italic">{holiday.localName}</div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 py-2 italic">
                        No holidays available for selected country
                      </div>
                    )}
                  </div>

                  {selectedHolidays.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <div className="text-sm font-semibold text-blue-900">
                        {selectedHolidays.length} {selectedHolidays.length === 1 ? 'holiday' : 'holidays'} selected
                      </div>
                      <div className="text-xs text-blue-700 mt-1 space-y-1">
                        {selectedHolidays.slice(0, 3).map(h => (
                          <div key={h.date + h.name}>
                            {h.name} - {parseDateWithoutTimezone(h.date).toLocaleDateString()}
                            {blackout.blackout_type === 'holiday_weekend' && ' + weekend'}
                          </div>
                        ))}
                        {selectedHolidays.length > 3 && (
                          <div className="italic">...and {selectedHolidays.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  )}

                  {blackout.blackout_type === 'holiday_weekend' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <div className="text-xs text-yellow-800">
                        <strong>Note:</strong> Holiday weekend mode will block each holiday plus the surrounding
                        weekend (Friday-Monday), giving players a long weekend off for each selected holiday.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Applies To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applies To *
                </label>
                <select
                  value={blackout.applies_to}
                  onChange={(e) => setBlackout({ ...blackout, applies_to: e.target.value as 'league' | 'venues' | 'pitches', venue_ids: [], pitch_ids: [] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="league">League-wide</option>
                  <option value="venues">Specific Venues (all pitches)</option>
                  <option value="pitches">Specific Pitches</option>
                </select>
              </div>

              {/* Venue Selection */}
              {blackout.applies_to === 'venues' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Venues *
                  </label>
                  <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {venues.map(venue => (
                      <label key={venue.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={blackout.venue_ids.includes(venue.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBlackout({ ...blackout, venue_ids: [...blackout.venue_ids, venue.id] });
                            } else {
                              setBlackout({ ...blackout, venue_ids: blackout.venue_ids.filter(id => id !== venue.id) });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{venue.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Pitch Selection */}
              {blackout.applies_to === 'pitches' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Pitches *
                  </label>
                  <div className="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto space-y-3">
                    {venues.map(venue => (
                      <div key={venue.id} className="space-y-1">
                        <div className="font-semibold text-sm text-gray-700">{venue.name}</div>
                        <div className="pl-4 space-y-1">
                          {venue.pitches && venue.pitches.length > 0 ? (
                            venue.pitches.map(pitch => (
                              <label key={pitch.id} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={blackout.pitch_ids.includes(pitch.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setBlackout({
                                        ...blackout,
                                        pitch_ids: [...blackout.pitch_ids, pitch.id],
                                        venue_ids: blackout.venue_ids.includes(venue.id) ? blackout.venue_ids : [...blackout.venue_ids, venue.id]
                                      });
                                    } else {
                                      const newPitchIds = blackout.pitch_ids.filter(id => id !== pitch.id);
                                      const venueStillHasPitches = venue.pitches.some(p => newPitchIds.includes(p.id));
                                      setBlackout({
                                        ...blackout,
                                        pitch_ids: newPitchIds,
                                        venue_ids: venueStillHasPitches ? blackout.venue_ids : blackout.venue_ids.filter(id => id !== venue.id)
                                      });
                                    }
                                  }}
                                  className="rounded"
                                />
                                <span className="text-sm">{pitch.name}</span>
                              </label>
                            ))
                          ) : (
                            <div className="text-xs text-gray-500 italic">No pitches configured</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={blackout.notes}
                  onChange={(e) => setBlackout({ ...blackout, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-between pt-4">
                <div>
                  {blackoutId && (
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
