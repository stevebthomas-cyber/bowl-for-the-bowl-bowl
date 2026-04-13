/**
 * VenueModal Component
 *
 * Modal for adding/editing venues with pitches and availability.
 * Used for both creating new venues and editing existing ones.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';
import { datetimeLocalToISO, isoToDatetimeLocal } from '../../../utils/dateUtils';

interface VenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  venueId?: string | null; // null for new venue, string for editing
}

interface Pitch {
  id?: string;
  name: string;
  include_in_season: boolean;
}

interface VenueData {
  id?: string;
  name: string;
  address: string;
  include_in_season: boolean;
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

export default function VenueModal({ isOpen, onClose, leagueId, venueId }: VenueModalProps) {
  const [venue, setVenue] = useState<VenueData>({
    name: '',
    address: '',
    include_in_season: true,
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

  const [pitches, setPitches] = useState<Pitch[]>([{ name: '', include_in_season: true }]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (venueId) {
        loadVenue();
      } else {
        // Reset for new venue
        setVenue({
          name: '',
          address: '',
          include_in_season: true,
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
        setPitches([{ name: '', include_in_season: true }]);
      }
    }
  }, [isOpen, venueId]);

  const loadVenue = async () => {
    if (!venueId) return;

    setIsLoading(true);
    try {
      const { data: venueData, error: venueError } = await supabase
        .from('venues')
        .select('*')
        .eq('id', venueId)
        .single();

      if (venueError) throw venueError;

      setVenue({
        id: venueData.id,
        name: venueData.name,
        address: venueData.address || '',
        include_in_season: venueData.include_in_season,
        use_specific_dates: venueData.use_specific_dates || false,
        availability_start_datetime: venueData.availability_start_datetime || '',
        availability_end_datetime: venueData.availability_end_datetime || '',
        is_recurring: venueData.is_recurring || false,
        recurrence_type: venueData.recurrence_type || null,
        recurrence_days: venueData.recurrence_days || [],
        recurrence_interval: venueData.recurrence_interval || null,
        recurrence_period: venueData.recurrence_period || null,
        specific_dates: venueData.specific_dates || [],
      });

      // Load pitches
      const { data: pitchesData, error: pitchesError } = await supabase
        .from('pitches')
        .select('*')
        .eq('venue_id', venueId);

      if (pitchesError) throw pitchesError;

      if (pitchesData && pitchesData.length > 0) {
        setPitches(pitchesData.map(p => ({
          id: p.id,
          name: p.name,
          include_in_season: p.include_in_season,
        })));
      }
    } catch (err) {
      console.error('Error loading venue:', err);
      alert('Failed to load venue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!venue.name.trim()) {
      alert('Venue name is required');
      return;
    }

    const validPitches = pitches.filter(p => p.name.trim());
    if (validPitches.length === 0) {
      alert('At least one pitch is required');
      return;
    }

    setIsSaving(true);
    try {
      let savedVenueId = venueId;

      const venueData = {
        name: venue.name,
        address: venue.address,
        include_in_season: venue.include_in_season,
        use_specific_dates: venue.use_specific_dates,
        availability_start_datetime: venue.availability_start_datetime || null,
        availability_end_datetime: venue.availability_end_datetime || null,
        is_recurring: venue.is_recurring,
        recurrence_type: venue.recurrence_type,
        recurrence_days: venue.recurrence_days.length > 0 ? venue.recurrence_days : null,
        recurrence_interval: venue.recurrence_interval,
        recurrence_period: venue.recurrence_period,
        specific_dates: venue.specific_dates.length > 0 ? venue.specific_dates : null,
      };

      if (venueId) {
        // Update existing venue
        const { error } = await supabase
          .from('venues')
          .update(venueData)
          .eq('id', venueId);

        if (error) throw error;
      } else {
        // Create new venue
        const { data, error } = await supabase
          .from('venues')
          .insert({
            league_id: leagueId,
            ...venueData,
          })
          .select()
          .single();

        if (error) throw error;
        savedVenueId = data.id;
      }

      // Handle pitches
      if (savedVenueId) {
        // Delete removed pitches
        const existingPitchIds = pitches.filter(p => p.id).map(p => p.id!);
        if (venueId && existingPitchIds.length > 0) {
          await supabase
            .from('pitches')
            .delete()
            .eq('venue_id', savedVenueId)
            .not('id', 'in', `(${existingPitchIds.join(',')})`);
        }

        // Update or insert pitches
        for (const pitch of validPitches) {
          if (pitch.id) {
            // Update existing
            await supabase
              .from('pitches')
              .update({
                name: pitch.name,
                include_in_season: pitch.include_in_season,
              })
              .eq('id', pitch.id);
          } else {
            // Insert new
            await supabase
              .from('pitches')
              .insert({
                venue_id: savedVenueId,
                name: pitch.name,
                include_in_season: pitch.include_in_season,
              });
          }
        }
      }

      onClose();
    } catch (err) {
      console.error('Error saving venue:', err);
      alert('Failed to save venue');
    } finally {
      setIsSaving(false);
    }
  };

  const addPitch = () => {
    setPitches([...pitches, { name: '', include_in_season: true }]);
  };

  const removePitch = (index: number) => {
    setPitches(pitches.filter((_, i) => i !== index));
  };

  const updatePitch = (index: number, updates: Partial<Pitch>) => {
    const newPitches = [...pitches];
    newPitches[index] = { ...newPitches[index], ...updates };
    setPitches(newPitches);
  };

  const toggleRecurrenceDay = (day: string) => {
    const newDays = venue.recurrence_days.includes(day)
      ? venue.recurrence_days.filter(d => d !== day)
      : [...venue.recurrence_days, day];
    setVenue({ ...venue, recurrence_days: newDays });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            {venueId ? 'Edit Venue' : 'Add Venue'}
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
              {/* Venue Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Venue Name *
                </label>
                <input
                  type="text"
                  value={venue.name}
                  onChange={(e) => setVenue({ ...venue, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter venue name"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={venue.address}
                  onChange={(e) => setVenue({ ...venue, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter address"
                />
              </div>

              {/* Include in Season */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={venue.include_in_season}
                    onChange={(e) => setVenue({ ...venue, include_in_season: e.target.checked })}
                  />
                  <span className="text-sm font-medium">Include in Season</span>
                </label>
              </div>

              {/* Pitches */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pitches *
                </label>
                <div className="space-y-3">
                  {pitches.map((pitch, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={pitch.name}
                        onChange={(e) => updatePitch(index, { name: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder={`Pitch ${index + 1} name`}
                      />
                      <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap pt-2">
                        <input
                          type="checkbox"
                          checked={pitch.include_in_season}
                          onChange={(e) => updatePitch(index, { include_in_season: e.target.checked })}
                        />
                        <span className="text-xs">Include</span>
                      </label>
                      {pitches.length > 1 && (
                        <button
                          onClick={() => removePitch(index)}
                          className="px-2 py-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addPitch}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Add Pitch
                  </button>
                </div>
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
                      checked={!venue.use_specific_dates}
                      onChange={() => {
                        setVenue({ ...venue, use_specific_dates: false });
                      }}
                    />
                    <span className="text-sm">Single Time Range</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={venue.use_specific_dates}
                      onChange={() => {
                        setVenue({ ...venue, use_specific_dates: true });
                      }}
                    />
                    <span className="text-sm">Specific Dates (Calendar Picker)</span>
                  </label>
                </div>
              </div>

              {/* Recurring Availability Mode */}
              {!venue.use_specific_dates && (
                <div className="border-t pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date/Time</label>
                      <input
                        type="datetime-local"
                        value={isoToDatetimeLocal(venue.availability_start_datetime)}
                        onChange={(e) => setVenue({
                          ...venue,
                          availability_start_datetime: datetimeLocalToISO(e.target.value),
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">End Date/Time</label>
                      <input
                        type="datetime-local"
                        value={isoToDatetimeLocal(venue.availability_end_datetime)}
                        onChange={(e) => setVenue({
                          ...venue,
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
                        checked={venue.is_recurring}
                        onChange={(e) => setVenue({ ...venue, is_recurring: e.target.checked })}
                      />
                      <span className="text-sm font-medium">Make this recurring</span>
                    </label>
                  </div>

                  {/* Recurrence Options */}
                  {venue.is_recurring && (
                    <div className="pl-6 space-y-3 border-l-2 border-blue-200">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Recurrence Pattern</label>
                        <select
                          value={venue.recurrence_type || ''}
                          onChange={(e) => setVenue({ ...venue, recurrence_type: e.target.value as any })}
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
                      {venue.recurrence_type === 'on_certain_days' && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Days</label>
                          <div className="grid grid-cols-2 gap-2">
                            {DAYS_OF_WEEK.map((day) => (
                              <label key={day} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={venue.recurrence_days.includes(day)}
                                  onChange={() => toggleRecurrenceDay(day)}
                                />
                                <span className="text-sm">{day}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom - Every X period */}
                      {venue.recurrence_type === 'custom' && (
                        <div className="flex gap-2 items-center">
                          <span className="text-sm">Every</span>
                          <input
                            type="number"
                            min="1"
                            value={venue.recurrence_interval || ''}
                            onChange={(e) => setVenue({ ...venue, recurrence_interval: parseInt(e.target.value) || null })}
                            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="1"
                          />
                          <select
                            value={venue.recurrence_period || ''}
                            onChange={(e) => setVenue({ ...venue, recurrence_period: e.target.value as any })}
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
              {venue.use_specific_dates && (
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
