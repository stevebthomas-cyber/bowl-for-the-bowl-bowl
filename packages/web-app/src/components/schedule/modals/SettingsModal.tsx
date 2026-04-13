/**
 * SettingsModal Component
 *
 * Modal for configuring season schedule settings.
 * Auto-saves all changes to the seasons table.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  seasonNumber: number;
}

interface SeasonSettings {
  id?: string;
  season_name: string | null;
  min_teams: number | null;
  max_teams: number | null;
  number_of_divisions: number;
  games_per_team: number | null;
  number_of_rounds: number | null;
  game_duration_minutes: number;
  single_round_robin: boolean;
  double_round_robin: boolean;
  single_split_round_robin: boolean;
  double_split_round_robin: boolean;
  schedule_preference: 'compact' | 'relaxed' | null;
  game_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | null;
  preferred_days: string[];
  start_date: string | null;
  end_date: string | null;
  is_draft: boolean;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SettingsModal({ isOpen, onClose, leagueId, seasonNumber }: SettingsModalProps) {
  const [settings, setSettings] = useState<SeasonSettings>({
    season_name: null,
    min_teams: 4,
    max_teams: null,
    number_of_divisions: 1,
    games_per_team: null,
    number_of_rounds: null,
    game_duration_minutes: 75,
    single_round_robin: false,
    double_round_robin: false,
    single_split_round_robin: false,
    double_split_round_robin: false,
    schedule_preference: null,
    game_frequency: null,
    preferred_days: [],
    start_date: null,
    end_date: null,
    is_draft: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, leagueId, seasonNumber]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          season_name: data.season_name,
          min_teams: data.min_teams,
          max_teams: data.max_teams,
          number_of_divisions: data.number_of_divisions || 1,
          games_per_team: data.games_per_team,
          number_of_rounds: data.number_of_rounds,
          game_duration_minutes: data.game_duration_minutes || 75,
          single_round_robin: data.single_round_robin || false,
          double_round_robin: data.double_round_robin || false,
          single_split_round_robin: data.single_split_round_robin || false,
          double_split_round_robin: data.double_split_round_robin || false,
          schedule_preference: data.schedule_preference,
          game_frequency: data.game_frequency,
          preferred_days: data.preferred_days || [],
          start_date: data.start_date,
          end_date: data.end_date,
          is_draft: data.is_draft !== false,
        });
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (updates: Partial<SeasonSettings>) => {
    setIsSaving(true);
    try {
      const newSettings = { ...settings, ...updates };

      if (settings.id) {
        // Update existing
        const { error } = await supabase
          .from('seasons')
          .update(newSettings)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('seasons')
          .insert({
            league_id: leagueId,
            season_number: seasonNumber,
            ...newSettings,
          })
          .select()
          .single();

        if (error) throw error;
        newSettings.id = data.id;
      }

      setSettings(newSettings as SeasonSettings);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyChanges = async () => {
    // Check if we have enough information to generate
    const errors = await validateSettings();
    if (errors.length > 0) {
      alert('Cannot generate schedule:\n\n' + errors.join('\n'));
      return;
    }

    // Check if schedule already exists
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('league_id', leagueId)
      .eq('season_number', seasonNumber)
      .limit(1);

    if (existingMatches && existingMatches.length > 0) {
      if (!confirm('Regenerate schedule? This will delete all existing matches and create new ones based on your settings.')) {
        return;
      }

      // Delete existing matches
      await supabase
        .from('matches')
        .delete()
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber);
    }

    // Generate schedule
    await generateSchedule();
    alert('Schedule generated successfully! Refresh the page to see the new schedule.');
    onClose();
  };

  const calculateMinimumRounds = async (): Promise<number> => {
    // Use min_teams to determine schedule size (don't require actual teams to exist)
    const totalTeams = settings.min_teams || 0;
    const divisionsCount = settings.number_of_divisions || 1;
    const teamsPerDivision = Math.floor(totalTeams / divisionsCount);

    let minRounds = 0;

    // Single Round Robin: All teams play all teams once
    // N teams = N-1 rounds
    if (settings.single_round_robin) {
      minRounds += totalTeams - 1;
    }

    // Double Round Robin: All teams play home and away
    // N teams = 2(N-1) rounds
    if (settings.double_round_robin) {
      minRounds += 2 * (totalTeams - 1);
    }

    // Single Split RR: All teams play division teams once
    // D teams per division = D-1 rounds
    if (settings.single_split_round_robin) {
      minRounds += teamsPerDivision - 1;
    }

    // Double Split RR: All teams play division teams home and away
    // D teams per division = 2(D-1) rounds
    if (settings.double_split_round_robin) {
      minRounds += 2 * (teamsPerDivision - 1);
    }

    return minRounds;
  };

  const validateSettings = async (): Promise<string[]> => {
    const errors: string[] = [];

    // Must have minimum teams specified (even if no actual teams exist yet)
    if (!settings.min_teams || settings.min_teams < 2) {
      errors.push('• Minimum teams must be at least 2');
    }

    const hasScheduleType = settings.single_round_robin ||
                           settings.double_round_robin ||
                           settings.single_split_round_robin ||
                           settings.double_split_round_robin;

    if (!hasScheduleType && !settings.games_per_team && (!settings.number_of_rounds || settings.number_of_rounds < 1)) {
      errors.push('• Either select a schedule type, specify games per team, or specify number of rounds');
    }

    // Check for conflicts between schedule type and games_per_team
    if (hasScheduleType && settings.games_per_team && settings.min_teams && settings.min_teams >= 2) {
      const minRoundsFromType = await calculateMinimumRounds();
      const gamesPerTeam = settings.games_per_team;

      if (gamesPerTeam < minRoundsFromType) {
        errors.push(
          `• Conflict: Schedule types require ${minRoundsFromType} games per team, but only ${gamesPerTeam} specified.\n` +
          `  I can't make the full schedule until this is resolved.\n` +
          `  Using ${minRoundsFromType} games per team as the minimum.`
        );
      }
    }

    // Check if specified rounds is enough for selected schedule types
    if (hasScheduleType && settings.min_teams && settings.min_teams >= 2) {
      const minRounds = await calculateMinimumRounds();
      const specifiedRounds = settings.number_of_rounds || 0;

      if (specifiedRounds > 0 && specifiedRounds < minRounds) {
        errors.push(`• Selected schedule types require at least ${minRounds} rounds, but only ${specifiedRounds} specified`);
      }
    }

    return errors;
  };

  const generateSchedule = async () => {
    try {
      // Calculate how many matches we need based on settings
      const matches = await generateMatchesFromSettings();

      if (matches.length === 0) {
        throw new Error('No matches generated');
      }

      const { error } = await supabase
        .from('matches')
        .insert(matches);

      if (error) throw error;
    } catch (err) {
      console.error('Error generating schedule:', err);
      alert('Failed to generate schedule');
      throw err;
    }
  };

  /**
   * Generate round-robin pairings for a given number of teams
   * Returns array of rounds, where each round is an array of [homeTeam, awayTeam] pairs
   * Uses the circle method with home/away balancing
   */
  const generateRoundRobinPairings = (numTeams: number): Array<Array<[number, number]>> => {
    const rounds: Array<Array<[number, number]>> = [];

    // If odd number of teams, add a "bye" team
    const teams = Array.from({ length: numTeams }, (_, i) => i + 1);
    const hasOddTeams = numTeams % 2 === 1;
    if (hasOddTeams) {
      teams.push(-1); // -1 represents bye
    }

    const n = teams.length;
    const roundsCount = n - 1;
    const matchesPerRound = n / 2;

    for (let round = 0; round < roundsCount; round++) {
      const roundPairings: Array<[number, number]> = [];

      for (let match = 0; match < matchesPerRound; match++) {
        let home = teams[match];
        let away = teams[n - 1 - match];

        // Skip if either team is a bye
        if (home === -1 || away === -1) {
          continue;
        }

        // Alternate home/away to balance games
        // For even matches in odd rounds or odd matches in even rounds, swap home/away
        const shouldSwap = (round % 2 === 0 && match % 2 === 1) || (round % 2 === 1 && match % 2 === 0);

        if (shouldSwap) {
          [home, away] = [away, home];
        }

        roundPairings.push([home, away]);
      }

      rounds.push(roundPairings);

      // Rotate teams (keep first team fixed, rotate others clockwise)
      const last = teams.pop()!;
      teams.splice(1, 0, last);
    }

    return rounds;
  };

  const generateMatchesFromSettings = async () => {
    const matches: any[] = [];
    let matchNumber = 1;

    // Use min_teams to determine schedule size (don't require actual teams to exist)
    const totalTeams = settings.min_teams || 0;

    // Determine rounds needed based on priority:
    // 1. Explicitly specified number_of_rounds
    // 2. Calculate from games_per_team (with minimum from schedule types)
    // 3. Calculate minimum from schedule types
    let roundsNeeded = settings.number_of_rounds;

    if (!roundsNeeded) {
      const minRoundsFromType = await calculateMinimumRounds();

      if (settings.games_per_team) {
        // Use the greater of games_per_team or minimum from schedule types
        roundsNeeded = Math.max(settings.games_per_team, minRoundsFromType);
      } else {
        // Fall back to minimum rounds from schedule type
        roundsNeeded = minRoundsFromType;
      }
    }

    // Generate round-robin pairings (single round-robin)
    const singleRRPairings = generateRoundRobinPairings(totalTeams);

    // For double round-robin, we need both the original pairings and the reverse
    // (This ensures teams play both home and away against each opponent)
    const isDoubleRoundRobin = settings.double_round_robin || settings.double_split_round_robin;
    let allPairings: Array<Array<[number, number]>> = [...singleRRPairings];

    if (isDoubleRoundRobin) {
      // Add reverse fixtures (swap home and away)
      const reversePairings = singleRRPairings.map(round =>
        round.map(([home, away]): [number, number] => [away, home])
      );
      allPairings = [...singleRRPairings, ...reversePairings];
    }

    const totalRoundsInSchedule = allPairings.length;
    const fullCycles = Math.floor(roundsNeeded / totalRoundsInSchedule);
    const extraRounds = roundsNeeded % totalRoundsInSchedule;

    let currentRound = 1;

    // Generate full cycles
    for (let cycle = 0; cycle < fullCycles; cycle++) {
      for (const roundPairings of allPairings) {
        for (const [homeTeam, awayTeam] of roundPairings) {
          matches.push({
            league_id: leagueId,
            season_number: seasonNumber,
            match_number: matchNumber++,
            week_number: currentRound,
            home_team_id: null,
            away_team_id: null,
            venue_id: null,
            pitch_id: null,
            scheduled_date: null,
            status: 'scheduled',
            metadata: {
              homeSlot: `Team-${homeTeam}`,
              awaySlot: `Team-${awayTeam}`,
            },
          });
        }
        currentRound++;
      }
    }

    // Generate extra rounds if needed
    for (let i = 0; i < extraRounds; i++) {
      for (const [homeTeam, awayTeam] of allPairings[i]) {
        matches.push({
          league_id: leagueId,
          season_number: seasonNumber,
          match_number: matchNumber++,
          week_number: currentRound,
          home_team_id: null,
          away_team_id: null,
          venue_id: null,
          pitch_id: null,
          scheduled_date: null,
          status: 'scheduled',
          metadata: {
            homeSlot: `Team-${homeTeam}`,
            awaySlot: `Team-${awayTeam}`,
          },
        });
      }
      currentRound++;
    }

    return matches;
  };

  const handleDeleteSchedule = async () => {
    if (!confirm('Delete all scheduled matches for this season? This action is permanent and cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('league_id', leagueId)
        .eq('season_number', seasonNumber);

      if (error) throw error;

      alert('Schedule deleted successfully! Refresh the page to see the changes.');
    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert('Failed to delete schedule');
    }
  };

  const toggleDay = (day: string) => {
    const newDays = settings.preferred_days.includes(day)
      ? settings.preferred_days.filter(d => d !== day)
      : [...settings.preferred_days, day];

    saveSettings({ preferred_days: newDays });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Schedule Settings</h2>
          <button
            onClick={() => {
              handleApplyChanges();
            }}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {isSaving && (
            <div className="text-sm text-blue-600 italic">Saving...</div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Season Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Season Name
                </label>
                <input
                  type="text"
                  placeholder="Leave blank for Season 1, Season 2, etc."
                  value={settings.season_name || ''}
                  onChange={(e) => saveSettings({ season_name: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Number of Teams */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Minimum Teams
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={settings.min_teams || ''}
                    onChange={(e) => saveSettings({ min_teams: parseInt(e.target.value) || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Maximum Teams
                  </label>
                  <input
                    type="number"
                    min={settings.min_teams || 2}
                    value={settings.max_teams || ''}
                    onChange={(e) => saveSettings({ max_teams: parseInt(e.target.value) || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Number of Divisions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Divisions
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.number_of_divisions}
                  onChange={(e) => saveSettings({ number_of_divisions: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Games per Team & Number of Rounds */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Games per Team
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.games_per_team || ''}
                    onChange={(e) => saveSettings({ games_per_team: parseInt(e.target.value) || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Number of Rounds
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={settings.number_of_rounds || ''}
                    onChange={(e) => saveSettings({ number_of_rounds: parseInt(e.target.value) || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Game Duration */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Game Duration (minutes)
                </label>
                <input
                  type="number"
                  min="75"
                  value={settings.game_duration_minutes}
                  onChange={(e) => saveSettings({ game_duration_minutes: Math.max(75, parseInt(e.target.value) || 75) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum: 75 minutes</p>
              </div>

              {/* Schedule Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Schedule Type
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Select all that apply - these add together
                </p>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.single_round_robin}
                      onChange={(e) => saveSettings({ single_round_robin: e.target.checked })}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">Single Round Robin</div>
                      <div className="text-xs text-gray-600">All teams play all teams once</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.double_round_robin}
                      onChange={(e) => saveSettings({ double_round_robin: e.target.checked })}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">Double Round Robin</div>
                      <div className="text-xs text-gray-600">All teams play a home and away</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.single_split_round_robin}
                      onChange={(e) => saveSettings({ single_split_round_robin: e.target.checked })}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">Single Split Round Robin</div>
                      <div className="text-xs text-gray-600">All teams play a single game against their division</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.double_split_round_robin}
                      onChange={(e) => saveSettings({ double_split_round_robin: e.target.checked })}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">Double Split Round Robin</div>
                      <div className="text-xs text-gray-600">All teams play a home and away against their division</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Scheduling Options */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Scheduling Options
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedule_preference"
                      checked={settings.schedule_preference === 'compact'}
                      onChange={() => saveSettings({ schedule_preference: 'compact' })}
                    />
                    <div>
                      <div className="font-medium text-sm">Compact Schedule</div>
                      <div className="text-xs text-gray-600">Bias towards having as few rounds as possible</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="schedule_preference"
                      checked={settings.schedule_preference === 'relaxed'}
                      onChange={() => saveSettings({ schedule_preference: 'relaxed' })}
                    />
                    <div>
                      <div className="font-medium text-sm">Relaxed Schedule</div>
                      <div className="text-xs text-gray-600">Bias towards having the league finish on the end date</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Game Frequency */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Game Frequency
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['daily', 'weekly', 'biweekly', 'monthly', 'bimonthly'].map((freq) => (
                    <label key={freq} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="game_frequency"
                        checked={settings.game_frequency === freq}
                        onChange={() => saveSettings({ game_frequency: freq as any })}
                      />
                      <span className="text-sm capitalize">{freq}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preferred Days */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Preferred Days
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <label key={day} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.preferred_days.includes(day)}
                        onChange={() => toggleDay(day)}
                      />
                      <span className="text-sm">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={settings.start_date ? settings.start_date.split('T')[0] : ''}
                    onChange={(e) => saveSettings({ start_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={settings.end_date ? settings.end_date.split('T')[0] : ''}
                    onChange={(e) => saveSettings({ end_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Draft Checkbox */}
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.is_draft}
                    onChange={(e) => saveSettings({ is_draft: e.target.checked })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold text-sm">Draft</div>
                    <div className="text-xs text-gray-600">
                      Draft schedules will not be published and cannot be shared
                    </div>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <button
                  onClick={handleApplyChanges}
                  className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Apply Changes
                </button>
                <button
                  onClick={onClose}
                  className="w-full px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSchedule}
                  className="w-full px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  DELETE SCHEDULE
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Delete action is permanent and cannot be undone
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
