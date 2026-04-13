import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeague } from '../../hooks/useLeague';
import { supabase } from '../../config/supabase';
import CommissionerLayout from '../../components/layouts/CommissionerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';

interface Team {
  id: string;
  name: string;
  division: number | null;
}

interface ScheduleConfig {
  // Division settings
  intraDivisionGames: number; // Games against each division rival
  interDivisionGames: number; // Games against each cross-division opponent

  // Date/time settings
  defaultGameDay: number; // 0=Sunday, 1=Monday, etc.
  defaultGameTime: string; // "19:00"
  seasonStartDate: string; // ISO date
  seasonEndDate: string; // ISO date
  blackoutDates: string[]; // ISO dates

  // Schedule type
  scheduleType: 'round-robin' | 'divisional' | 'custom';

  // Target
  targetGamesPerTeam: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  calculations: {
    teamsCount: number;
    divisionsCount: number;
    teamsPerDivision: number;
    intraDivisionMatchesPerTeam: number;
    interDivisionMatchesPerTeam: number;
    totalGamesPerTeam: number;
    totalMatches: number;
    weeksNeeded: number;
    weeksAvailable: number;
  };
}

interface ScheduledMatch {
  matchNumber: number;
  homeSlot: string; // e.g., "D1-S1" (Division 1, Slot 1) or team ID if assigned
  homeTeamName?: string; // Only set if team is assigned
  awaySlot: string; // e.g., "D1-S2" or team ID if assigned
  awayTeamName?: string; // Only set if team is assigned
  scheduledDate: string; // ISO date
  weekNumber: number;
  matchType: 'intra-division' | 'inter-division' | 'round-robin';
}

export default function ScheduleWizardPage() {
  const navigate = useNavigate();
  const { league, isLoading: leagueLoading } = useLeague();
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<ScheduleConfig>({
    intraDivisionGames: 2,
    interDivisionGames: 1,
    defaultGameDay: 6, // Saturday
    defaultGameTime: '19:00',
    seasonStartDate: new Date().toISOString().split('T')[0],
    seasonEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    blackoutDates: [],
    scheduleType: 'divisional',
    targetGamesPerTeam: 10,
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduledMatch[]>([]);

  useEffect(() => {
    async function loadTeams() {
      if (!league) return;

      const { data, error } = await supabase
        .from('teams')
        .select('id, name, division')
        .eq('league_id', league.id)
        .eq('active', true)
        .is('deleted_at', null)
        .order('division')
        .order('name');

      if (!error && data) {
        setTeams(data);
      }
    }

    loadTeams();
  }, [league]);

  // Real-time validation
  useEffect(() => {
    if (!league || teams.length === 0) return;

    const validate = (): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Count divisions
      const divisions = new Set(teams.map(t => t.division ?? 1));
      const divisionsCount = divisions.size;
      const teamsPerDivision = Math.floor(teams.length / divisionsCount);

      // Calculate games based on schedule type
      let intraDivisionMatchesPerTeam = 0;
      let interDivisionMatchesPerTeam = 0;

      if (config.scheduleType === 'round-robin') {
        // Everyone plays everyone
        intraDivisionMatchesPerTeam = (teams.length - 1) * 1;
        interDivisionMatchesPerTeam = 0;
      } else if (config.scheduleType === 'divisional') {
        // Intra-division: each team plays (teamsPerDivision - 1) rivals
        intraDivisionMatchesPerTeam = (teamsPerDivision - 1) * config.intraDivisionGames;

        // Inter-division: each team plays teams from other divisions
        const crossDivisionTeams = teams.length - teamsPerDivision;
        interDivisionMatchesPerTeam = crossDivisionTeams * config.interDivisionGames;
      }

      const totalGamesPerTeam = intraDivisionMatchesPerTeam + interDivisionMatchesPerTeam;
      const totalMatches = (teams.length * totalGamesPerTeam) / 2;

      // Check if it matches target
      if (totalGamesPerTeam !== config.targetGamesPerTeam) {
        const diff = totalGamesPerTeam - config.targetGamesPerTeam;
        if (diff > 0) {
          errors.push(`Configuration creates ${totalGamesPerTeam} games per team, but target is ${config.targetGamesPerTeam} (${diff} too many)`);
        } else {
          errors.push(`Configuration creates ${totalGamesPerTeam} games per team, but target is ${config.targetGamesPerTeam} (${Math.abs(diff)} too few)`);
        }
      }

      // Calculate timeline
      const startDate = new Date(config.seasonStartDate);
      const endDate = new Date(config.seasonEndDate);
      const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const weeksAvailable = Math.floor(daysDiff / 7);

      // Max concurrent matches (half the teams can play at once)
      const maxConcurrentMatches = Math.floor(teams.length / 2);
      const weeksNeeded = Math.ceil(totalMatches / maxConcurrentMatches);

      if (weeksNeeded > weeksAvailable) {
        errors.push(`Need ${weeksNeeded} weeks but only ${weeksAvailable} weeks available. Extend season by ${weeksNeeded - weeksAvailable} weeks or reduce games.`);
      }

      // Check for unbalanced divisions
      if (config.scheduleType === 'divisional') {
        const teamCounts = Array.from(divisions).map(div =>
          teams.filter(t => (t.division ?? 1) === div).length
        );
        const allEqual = teamCounts.every(c => c === teamCounts[0]);
        if (!allEqual) {
          warnings.push(`Divisions are unbalanced: ${teamCounts.join(', ')} teams. This may create scheduling issues.`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        calculations: {
          teamsCount: teams.length,
          divisionsCount,
          teamsPerDivision,
          intraDivisionMatchesPerTeam,
          interDivisionMatchesPerTeam,
          totalGamesPerTeam,
          totalMatches,
          weeksNeeded,
          weeksAvailable,
        },
      };
    };

    setValidation(validate());
  }, [config, teams, league]);

  const updateConfig = (updates: Partial<ScheduleConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // Generate schedule with abstract slots
  const generateSchedule = () => {
    const schedule: ScheduledMatch[] = [];
    let matchNumber = 1;

    if (config.scheduleType === 'round-robin') {
      // Round-robin: create slots for all teams
      const numSlots = validation?.calculations.teamsCount || teams.length;
      const slots = Array.from({ length: numSlots }, (_, i) => `SLOT-${i + 1}`);

      if (slots.length % 2 !== 0) {
        slots.push('BYE');
      }

      const numRounds = slots.length - 1;
      const halfSize = slots.length / 2;
      const slotIndices = slots.map((_, i) => i);

      for (let round = 0; round < numRounds; round++) {
        for (let i = 0; i < halfSize; i++) {
          const home = slotIndices[i];
          const away = slotIndices[slots.length - 1 - i];

          if (slots[home] === 'BYE' || slots[away] === 'BYE') continue;

          // Try to assign actual teams if they exist
          const homeTeam = teams[home];
          const awayTeam = teams[away];

          schedule.push({
            matchNumber: matchNumber++,
            homeSlot: homeTeam?.id || slots[home],
            homeTeamName: homeTeam?.name,
            awaySlot: awayTeam?.id || slots[away],
            awayTeamName: awayTeam?.name,
            scheduledDate: '',
            weekNumber: 0,
            matchType: 'round-robin',
          });
        }
        slotIndices.splice(1, 0, slotIndices.pop()!);
      }
    } else if (config.scheduleType === 'divisional') {
      // Divisional: create abstract division slots
      const divisionsCount = validation?.calculations.divisionsCount || 1;
      const teamsPerDivision = validation?.calculations.teamsPerDivision || teams.length;

      // Create division slot structure
      const divisionSlots: string[][] = [];
      for (let d = 0; d < divisionsCount; d++) {
        const divSlots = Array.from({ length: teamsPerDivision }, (_, s) => `D${d + 1}-S${s + 1}`);
        divisionSlots.push(divSlots);
      }

      // Try to map existing teams to slots
      const teamsByDivision = new Map<number, Team[]>();
      teams.forEach(team => {
        const div = team.division ?? 1;
        if (!teamsByDivision.has(div)) teamsByDivision.set(div, []);
        teamsByDivision.get(div)!.push(team);
      });

      // Intra-division games
      for (let d = 0; d < divisionsCount; d++) {
        const slots = divisionSlots[d];
        const divTeams = teamsByDivision.get(d + 1) || [];

        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            for (let game = 0; game < config.intraDivisionGames; game++) {
              const isHomeFirst = game % 2 === 0;
              const homeIdx = isHomeFirst ? i : j;
              const awayIdx = isHomeFirst ? j : i;

              schedule.push({
                matchNumber: matchNumber++,
                homeSlot: divTeams[homeIdx]?.id || slots[homeIdx],
                homeTeamName: divTeams[homeIdx]?.name,
                awaySlot: divTeams[awayIdx]?.id || slots[awayIdx],
                awayTeamName: divTeams[awayIdx]?.name,
                scheduledDate: '',
                weekNumber: 0,
                matchType: 'intra-division',
              });
            }
          }
        }
      }

      // Inter-division games
      for (let d1 = 0; d1 < divisionsCount; d1++) {
        for (let d2 = d1 + 1; d2 < divisionsCount; d2++) {
          const slots1 = divisionSlots[d1];
          const slots2 = divisionSlots[d2];
          const teams1 = teamsByDivision.get(d1 + 1) || [];
          const teams2 = teamsByDivision.get(d2 + 1) || [];

          for (let s1 = 0; s1 < slots1.length; s1++) {
            for (let s2 = 0; s2 < slots2.length; s2++) {
              for (let game = 0; game < config.interDivisionGames; game++) {
                const isHomeFirst = game % 2 === 0;

                schedule.push({
                  matchNumber: matchNumber++,
                  homeSlot: isHomeFirst ? (teams1[s1]?.id || slots1[s1]) : (teams2[s2]?.id || slots2[s2]),
                  homeTeamName: isHomeFirst ? teams1[s1]?.name : teams2[s2]?.name,
                  awaySlot: isHomeFirst ? (teams2[s2]?.id || slots2[s2]) : (teams1[s1]?.id || slots1[s1]),
                  awayTeamName: isHomeFirst ? teams2[s2]?.name : teams1[s1]?.name,
                  scheduledDate: '',
                  weekNumber: 0,
                  matchType: 'inter-division',
                });
              }
            }
          }
        }
      }
    }

    // Assign dates to matches
    const maxConcurrentMatches = Math.floor(teams.length / 2);
    let currentWeek = 0;
    let currentDate = new Date(config.seasonStartDate);

    // Move to first game day
    while (currentDate.getDay() !== config.defaultGameDay) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    for (let i = 0; i < schedule.length; i += maxConcurrentMatches) {
      // Skip blackout dates
      while (config.blackoutDates.includes(currentDate.toISOString().split('T')[0])) {
        currentDate.setDate(currentDate.getDate() + 7);
      }

      // Assign this week's matches
      const weekMatches = schedule.slice(i, i + maxConcurrentMatches);
      weekMatches.forEach(match => {
        match.scheduledDate = currentDate.toISOString().split('T')[0];
        match.weekNumber = currentWeek + 1;
      });

      // Move to next week
      currentWeek++;
      currentDate.setDate(currentDate.getDate() + 7);
    }

    setGeneratedSchedule(schedule);
  };

  if (leagueLoading) {
    return (
      <CommissionerLayout>
        <LoadingSpinner message="Loading..." />
      </CommissionerLayout>
    );
  }

  if (!league) {
    return (
      <CommissionerLayout>
        <ErrorMessage message="League not found" />
      </CommissionerLayout>
    );
  }

  return (
    <CommissionerLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Schedule Wizard</h1>
          <div className="text-sm text-gray-600">
            Step {currentStep} of 5
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(step => (
            <div
              key={step}
              className={`flex-1 h-2 rounded ${
                step <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Schedule Configuration */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Schedule Configuration</h2>

              {/* Schedule Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Schedule Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="scheduleType"
                      value="round-robin"
                      checked={config.scheduleType === 'round-robin'}
                      onChange={() => updateConfig({ scheduleType: 'round-robin' })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-semibold">Round-Robin</div>
                      <div className="text-sm text-gray-600">Every team plays every other team once</div>
                    </div>
                  </label>

                  <label className="flex items-center p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="scheduleType"
                      value="divisional"
                      checked={config.scheduleType === 'divisional'}
                      onChange={() => updateConfig({ scheduleType: 'divisional' })}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-semibold">Divisional Focus</div>
                      <div className="text-sm text-gray-600">Play division rivals more often, cross-division less</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Divisional Settings */}
              {config.scheduleType === 'divisional' && (
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Intra-Division Games (vs each rival)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="4"
                      value={config.intraDivisionGames}
                      onChange={(e) => updateConfig({ intraDivisionGames: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      How many times each team plays division rivals
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Inter-Division Games (vs each cross-division team)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      value={config.interDivisionGames}
                      onChange={(e) => updateConfig({ interDivisionGames: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      How many times each team plays cross-division opponents
                    </p>
                  </div>
                </div>
              )}

              {/* Target Games */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Games Per Team
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={config.targetGamesPerTeam}
                  onChange={(e) => updateConfig({ targetGamesPerTeam: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Real-time Validation Display */}
            {validation && (
              <div className={`border-2 rounded-lg p-6 ${
                validation.isValid ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
              }`}>
                <h3 className="text-xl font-bold mb-4">
                  {validation.isValid ? '✓ Schedule Math' : '⚠️ Configuration Issues'}
                </h3>

                {/* Calculations */}
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600">Teams</div>
                    <div className="text-2xl font-bold">{validation.calculations.teamsCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Divisions</div>
                    <div className="text-2xl font-bold">{validation.calculations.divisionsCount}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Intra-Division Games</div>
                    <div className="text-2xl font-bold">{validation.calculations.intraDivisionMatchesPerTeam}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Inter-Division Games</div>
                    <div className="text-2xl font-bold">{validation.calculations.interDivisionMatchesPerTeam}</div>
                  </div>
                  <div className={validation.calculations.totalGamesPerTeam === config.targetGamesPerTeam ? 'text-green-900' : 'text-red-900'}>
                    <div className="text-sm">Total Games Per Team</div>
                    <div className="text-2xl font-bold">{validation.calculations.totalGamesPerTeam}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Total Matches</div>
                    <div className="text-2xl font-bold">{validation.calculations.totalMatches}</div>
                  </div>
                </div>

                {/* Errors */}
                {validation.errors.length > 0 && (
                  <div className="mb-4">
                    <div className="font-semibold text-red-900 mb-2">Errors to Fix:</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {validation.errors.map((error, i) => (
                        <li key={i} className="text-red-800">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {validation.warnings.length > 0 && (
                  <div>
                    <div className="font-semibold text-yellow-900 mb-2">Warnings:</div>
                    <ul className="list-disc pl-5 space-y-1">
                      {validation.warnings.map((warning, i) => (
                        <li key={i} className="text-yellow-800">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => navigate('/commissioner/schedule')}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!validation?.isValid}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next: Date & Time Settings
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Date & Time Settings */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Date & Time Settings</h2>

              {/* Default Game Day */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Game Day
                </label>
                <select
                  value={config.defaultGameDay}
                  onChange={(e) => updateConfig({ defaultGameDay: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The default day of the week for scheduled matches
                </p>
              </div>

              {/* Default Game Time */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Game Time
                </label>
                <input
                  type="time"
                  value={config.defaultGameTime}
                  onChange={(e) => updateConfig({ defaultGameTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The default time for scheduled matches (24-hour format)
                </p>
              </div>

              {/* Season Date Range */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Season Start Date
                  </label>
                  <input
                    type="date"
                    value={config.seasonStartDate}
                    onChange={(e) => updateConfig({ seasonStartDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    First possible match date
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Season End Date
                  </label>
                  <input
                    type="date"
                    value={config.seasonEndDate}
                    onChange={(e) => updateConfig({ seasonEndDate: e.target.value })}
                    min={config.seasonStartDate}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Last possible match date
                  </p>
                </div>
              </div>

              {/* Blackout Dates */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Blackout Dates (Optional)
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value && !config.blackoutDates.includes(e.target.value)) {
                        updateConfig({ blackoutDates: [...config.blackoutDates, e.target.value].sort() });
                        e.target.value = '';
                      }
                    }}
                    min={config.seasonStartDate}
                    max={config.seasonEndDate}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500">
                    Add dates when matches cannot be scheduled (holidays, breaks, etc.)
                  </p>

                  {config.blackoutDates.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {config.blackoutDates.map((date) => (
                        <div
                          key={date}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full"
                        >
                          <span className="text-sm text-gray-700">
                            {new Date(date + 'T00:00:00').toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => updateConfig({
                              blackoutDates: config.blackoutDates.filter(d => d !== date)
                            })}
                            className="text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline Preview */}
            {validation && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Timeline Preview</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Season Duration</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {Math.floor((new Date(config.seasonEndDate).getTime() - new Date(config.seasonStartDate).getTime()) / (1000 * 60 * 60 * 24))} days
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Available Weeks</div>
                    <div className={`text-2xl font-bold ${
                      validation.calculations.weeksAvailable >= validation.calculations.weeksNeeded
                        ? 'text-green-900'
                        : 'text-red-900'
                    }`}>
                      {validation.calculations.weeksAvailable}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Weeks Needed</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {validation.calculations.weeksNeeded}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Blackout Dates</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {config.blackoutDates.length}
                    </div>
                  </div>
                </div>

                {/* Timeline Warning */}
                {validation.calculations.weeksAvailable < validation.calculations.weeksNeeded && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded p-4">
                    <p className="text-red-900 font-semibold">Timeline Issue</p>
                    <p className="text-red-800 text-sm">
                      You need {validation.calculations.weeksNeeded - validation.calculations.weeksAvailable} more week(s).
                      Either extend the season end date or reduce the number of matches.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                disabled={!validation?.isValid}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Next: Generate Schedule
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Generate & Preview */}
        {currentStep === 3 && (
          <div className="space-y-6">
            {generatedSchedule.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Generate Schedule</h2>
                <p className="text-gray-600 mb-6">
                  Ready to generate your schedule. This will create {validation?.calculations.totalMatches} matches
                  across {validation?.calculations.weeksNeeded} weeks.
                </p>

                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-blue-900 mb-4">Schedule Summary</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-800">Schedule Type:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {config.scheduleType === 'round-robin' ? 'Round-Robin' : 'Divisional Focus'}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-800">Games Per Team:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {validation?.calculations.totalGamesPerTeam}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-800">Default Game Day:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][config.defaultGameDay]}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-800">Default Game Time:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {config.defaultGameTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-800">Season Start:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {new Date(config.seasonStartDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-800">Season End:</span>
                      <span className="ml-2 font-semibold text-blue-900">
                        {new Date(config.seasonEndDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={generateSchedule}
                  className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                >
                  Generate Schedule
                </button>

                <div className="flex justify-between mt-6">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Preview Generated Schedule */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Generated Schedule Preview
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {generatedSchedule.length} matches created across{' '}
                    {Math.max(...generatedSchedule.map(m => m.weekNumber))} weeks
                  </p>

                  {/* Week-by-week breakdown */}
                  <div className="space-y-6 max-h-[600px] overflow-y-auto">
                    {Array.from(new Set(generatedSchedule.map(m => m.weekNumber))).sort((a, b) => a - b).map(week => {
                      const weekMatches = generatedSchedule.filter(m => m.weekNumber === week);
                      const weekDate = weekMatches[0]?.scheduledDate;

                      return (
                        <div key={week} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-gray-900">Week {week}</h3>
                            <span className="text-sm text-gray-600">
                              {weekDate ? new Date(weekDate + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              }) : ''}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {weekMatches.map(match => (
                              <div
                                key={match.matchNumber}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded"
                              >
                                <span className="text-xs text-gray-500 w-16">#{match.matchNumber}</span>
                                <div className="flex-1 flex items-center justify-between">
                                  <span className={match.homeTeamName ? 'font-semibold text-gray-900' : 'italic text-gray-500'}>
                                    {match.homeTeamName || `[${match.homeSlot}]`}
                                  </span>
                                  <span className="text-gray-500 mx-4">vs</span>
                                  <span className={match.awayTeamName ? 'font-semibold text-gray-900' : 'italic text-gray-500'}>
                                    {match.awayTeamName || `[${match.awaySlot}]`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <span className="text-xs text-gray-500 px-2 py-1 bg-gray-200 rounded">
                                    {match.matchType === 'intra-division' ? 'Intra' : match.matchType === 'inter-division' ? 'Inter' : 'RR'}
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
                </div>

                {/* Navigation */}
                <div className="flex justify-between">
                  <button
                    onClick={() => {
                      setGeneratedSchedule([]);
                      setCurrentStep(2);
                    }}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Back & Regenerate
                  </button>
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Next: Review & Save
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 4: Team Assignment (Optional) */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Team Assignment</h2>
              <p className="text-gray-600 mb-6">
                {teams.length > 0
                  ? `Assign teams to schedule slots. ${generatedSchedule.filter(m => m.homeTeamName && m.awayTeamName).length} of ${generatedSchedule.length} matches have teams assigned.`
                  : 'No teams registered yet. You can save the schedule template and assign teams later.'}
              </p>

              {teams.length > 0 ? (
                <div className="space-y-4">
                  {/* Show unassigned slots */}
                  {(() => {
                    const allSlots = new Set<string>();
                    generatedSchedule.forEach(m => {
                      if (!m.homeTeamName) allSlots.add(m.homeSlot);
                      if (!m.awayTeamName) allSlots.add(m.awaySlot);
                    });

                    const unassignedSlots = Array.from(allSlots).filter(slot =>
                      !slot.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
                    );

                    if (unassignedSlots.length === 0) {
                      return (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-green-900 font-semibold">All slots assigned!</p>
                          <p className="text-green-800 text-sm">Every match has teams assigned.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-yellow-900 font-semibold mb-2">
                          {unassignedSlots.length} slot(s) need team assignment
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {unassignedSlots.map(slot => (
                            <span key={slot} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                              {slot}
                            </span>
                          ))}
                        </div>
                        <p className="text-yellow-800 text-sm mt-2">
                          You can still save the schedule and assign teams later from the schedule management page.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Team assignment interface would go here in a future enhancement */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-900 text-sm">
                      <strong>Note:</strong> Team-to-slot assignment UI will be available in the schedule management page.
                      For now, teams are auto-assigned based on their current division if available.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-700">
                    Once teams register and are assigned to divisions, they'll automatically fill the schedule slots.
                  </p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Back
              </button>
              <button
                onClick={() => setCurrentStep(5)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next: Final Review
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Final Review & Save */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Final Review & Save</h2>

              {/* Summary Stats */}
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm text-blue-800">Total Matches</div>
                  <div className="text-3xl font-bold text-blue-900">{generatedSchedule.length}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-green-800">Weeks</div>
                  <div className="text-3xl font-bold text-green-900">
                    {Math.max(...generatedSchedule.map(m => m.weekNumber))}
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-sm text-purple-800">Teams Assigned</div>
                  <div className="text-3xl font-bold text-purple-900">
                    {new Set([...generatedSchedule.filter(m => m.homeTeamName).map(m => m.homeSlot), ...generatedSchedule.filter(m => m.awayTeamName).map(m => m.awaySlot)]).size}
                  </div>
                </div>
              </div>

              {/* Configuration Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Schedule Configuration</h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-600">Type:</span> <span className="font-semibold ml-2">{config.scheduleType === 'round-robin' ? 'Round-Robin' : 'Divisional Focus'}</span></div>
                  <div><span className="text-gray-600">Games per Team:</span> <span className="font-semibold ml-2">{validation?.calculations.totalGamesPerTeam}</span></div>
                  <div><span className="text-gray-600">Game Day:</span> <span className="font-semibold ml-2">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][config.defaultGameDay]}</span></div>
                  <div><span className="text-gray-600">Game Time:</span> <span className="font-semibold ml-2">{config.defaultGameTime}</span></div>
                  <div><span className="text-gray-600">Start Date:</span> <span className="font-semibold ml-2">{new Date(config.seasonStartDate).toLocaleDateString()}</span></div>
                  <div><span className="text-gray-600">End Date:</span> <span className="font-semibold ml-2">{new Date(config.seasonEndDate).toLocaleDateString()}</span></div>
                </div>
              </div>

              {/* Warning if slots unassigned */}
              {(() => {
                const unassignedCount = generatedSchedule.filter(m => !m.homeTeamName || !m.awayTeamName).length;
                if (unassignedCount > 0) {
                  return (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <p className="text-yellow-900 font-semibold">Note: Schedule uses abstract slots</p>
                      <p className="text-yellow-800 text-sm">
                        {unassignedCount} match(es) use abstract slots instead of specific teams.
                        This is normal - teams will be assigned to slots as they register or can be manually assigned later.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Save Button */}
              <button
                onClick={async () => {
                  if (!league) return;

                  try {
                    // Delete existing matches
                    await supabase
                      .from('matches')
                      .delete()
                      .eq('league_id', league.id)
                      .eq('season_number', league.season_number);

                    // Insert new matches
                    const matchInserts = generatedSchedule.map(match => ({
                      league_id: league.id,
                      season_number: league.season_number,
                      match_number: match.matchNumber,
                      // Use slot as team ID if it's a UUID, otherwise leave null
                      home_team_id: match.homeSlot.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? match.homeSlot : null,
                      away_team_id: match.awaySlot.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? match.awaySlot : null,
                      // Store slot identifiers in a JSON field for later assignment
                      metadata: {
                        homeSlot: match.homeSlot,
                        awaySlot: match.awaySlot,
                        matchType: match.matchType,
                      },
                      scheduled_date: match.scheduledDate ? new Date(match.scheduledDate + 'T' + config.defaultGameTime).toISOString() : null,
                      week_number: match.weekNumber,
                      status: 'scheduled',
                    }));

                    const { error } = await supabase
                      .from('matches')
                      .insert(matchInserts);

                    if (error) throw error;

                    // Success - navigate back to schedule page
                    navigate('/commissioner/schedule');
                  } catch (err) {
                    console.error('Error saving schedule:', err);
                    alert('Failed to save schedule: ' + (err instanceof Error ? err.message : 'Unknown error'));
                  }
                }}
                className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
              >
                Save Schedule to Database
              </button>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </CommissionerLayout>
  );
}
