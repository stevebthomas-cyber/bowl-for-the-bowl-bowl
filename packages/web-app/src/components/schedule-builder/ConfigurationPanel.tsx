/**
 * ConfigurationPanel Component
 *
 * Left-side configuration panel for schedule builder settings.
 */

import { useState } from 'react';
import type { Team, ScheduleConfig, ScheduledMatch } from '../../types/schedule';

interface ConfigurationPanelProps {
  config: ScheduleConfig;
  teams: Team[];
  schedule: ScheduledMatch[];
  onConfigUpdate: (updates: Partial<ScheduleConfig>) => void;
  onSave: () => void;
  isSaving: boolean;
  hasErrors: boolean;
}

export default function ConfigurationPanel({
  config,
  teams,
  schedule,
  onConfigUpdate,
  onSave,
  isSaving,
  hasErrors
}: ConfigurationPanelProps) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [blackoutRangeStart, setBlackoutRangeStart] = useState('');
  const [blackoutRangeEnd, setBlackoutRangeEnd] = useState('');

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleGameDay = (day: number) => {
    if (config.gameDays.includes(day)) {
      onConfigUpdate({ gameDays: config.gameDays.filter(d => d !== day) });
    } else {
      onConfigUpdate({ gameDays: [...config.gameDays, day].sort() });
    }
  };

  const addBlackoutDateRange = () => {
    if (!blackoutRangeStart || !blackoutRangeEnd) return;

    const start = new Date(blackoutRangeStart);
    const end = new Date(blackoutRangeEnd);
    const newDates: string[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!config.blackoutDates.includes(dateStr)) {
        newDates.push(dateStr);
      }
    }

    if (newDates.length > 0) {
      onConfigUpdate({ blackoutDates: [...config.blackoutDates, ...newDates].sort() });
    }

    setBlackoutRangeStart('');
    setBlackoutRangeEnd('');
  };

  const clearAllBlackoutDates = () => {
    onConfigUpdate({ blackoutDates: [] });
  };

  return (
    <div className="lg:col-span-1 space-y-4">
      {/* Schedule Type */}
      <div className="bg-white rounded-lg shadow">
        <button
          onClick={() => toggleSection('scheduleType')}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50"
        >
          <h2 className="text-xl font-bold text-gray-900">Schedule Type</h2>
          <span className="text-gray-600">{collapsedSections['scheduleType'] ? '▼' : '▲'}</span>
        </button>

        {!collapsedSections['scheduleType'] && (
          <div className="px-6 pb-6 space-y-3">
            <label className="flex items-center">
              <input
                type="radio"
                value="divisional"
                checked={config.scheduleType === 'divisional'}
                onChange={(e) => onConfigUpdate({ scheduleType: e.target.value as any })}
                className="mr-2"
              />
              <div>
                <div className="font-medium">Divisional Focus</div>
                <div className="text-sm text-gray-600">More intra-division, some inter-division</div>
              </div>
            </label>

            <label className="flex items-center">
              <input
                type="radio"
                value="round-robin"
                checked={config.scheduleType === 'round-robin'}
                onChange={(e) => onConfigUpdate({ scheduleType: e.target.value as any })}
                className="mr-2"
              />
              <div>
                <div className="font-medium">Round-Robin</div>
                <div className="text-sm text-gray-600">Everyone plays everyone</div>
              </div>
            </label>

            <label className="flex items-center">
              <input
                type="radio"
                value="pool-only"
                checked={config.scheduleType === 'pool-only'}
                onChange={(e) => onConfigUpdate({ scheduleType: e.target.value as any })}
                className="mr-2"
              />
              <div>
                <div className="font-medium">Pool Play Only</div>
                <div className="text-sm text-gray-600">Separate pools, no crossover</div>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Divisional Settings */}
      {config.scheduleType === 'divisional' && (
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => toggleSection('divisional')}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50"
          >
            <h3 className="text-lg font-bold text-gray-900">Divisional Settings</h3>
            <span className="text-gray-600">{collapsedSections['divisional'] ? '▼' : '▲'}</span>
          </button>

          {!collapsedSections['divisional'] && (
            <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Divisions</label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={config.divisionsCount}
                  onChange={(e) => onConfigUpdate({ divisionsCount: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teams per Division</label>
                <input
                  type="number"
                  min="2"
                  max="12"
                  value={config.teamsPerDivision}
                  onChange={(e) => onConfigUpdate({ teamsPerDivision: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intra-Division Games</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={config.intraDivisionGames}
                  onChange={(e) => onConfigUpdate({ intraDivisionGames: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Games vs each division opponent</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inter-Division Games</label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={config.interDivisionGames}
                  onChange={(e) => onConfigUpdate({ interDivisionGames: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Games vs each other-division team</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pool Settings */}
      {config.scheduleType === 'pool-only' && (
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => toggleSection('pool')}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50"
          >
            <h3 className="text-lg font-bold text-gray-900">Pool Settings</h3>
            <span className="text-gray-600">{collapsedSections['pool'] ? '▼' : '▲'}</span>
          </button>

          {!collapsedSections['pool'] && (
            <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Pools</label>
                <input
                  type="number"
                  min="2"
                  max="8"
                  value={config.poolsCount}
                  onChange={(e) => onConfigUpdate({ poolsCount: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teams per Pool</label>
                <input
                  type="number"
                  min="3"
                  max="8"
                  value={config.teamsPerPool}
                  onChange={(e) => onConfigUpdate({ teamsPerPool: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Games per Team in Pool</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={config.gamesPerTeamInPool}
                  onChange={(e) => onConfigUpdate({ gamesPerTeamInPool: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scheduling Settings */}
      <div className="bg-white rounded-lg shadow">
        <button
          onClick={() => toggleSection('scheduling')}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50"
        >
          <h3 className="text-lg font-bold text-gray-900">Scheduling</h3>
          <span className="text-gray-600">{collapsedSections['scheduling'] ? '▼' : '▲'}</span>
        </button>

        {!collapsedSections['scheduling'] && (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
              <select
                value={config.schedulingPeriod}
                onChange={(e) => onConfigUpdate({ schedulingPeriod: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-Weekly (every 2 weeks)</option>
                <option value="semi-weekly">Semi-Weekly (twice per week)</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {config.schedulingPeriod === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Days Between Games</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={config.customDaysBetween}
                  onChange={(e) => onConfigUpdate({ customDaysBetween: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Game Days</label>
              <div className="grid grid-cols-7 gap-1">
                {dayNames.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleGameDay(idx)}
                    className={`px-2 py-2 text-xs font-medium rounded ${
                      config.gameDays.includes(idx)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Select one or more days for games</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Games per Meetup</label>
              <input
                type="number"
                min="1"
                max="5"
                value={config.gamesPerMeetup}
                onChange={(e) => onConfigUpdate({ gamesPerMeetup: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">How many matches to play when teams meet</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matches per Day</label>
              <input
                type="number"
                min="1"
                max="20"
                value={config.matchesPerDay}
                onChange={(e) => onConfigUpdate({ matchesPerDay: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">Max number of matches that can be played per day</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Game Time</label>
              <input
                type="time"
                value={config.defaultGameTime}
                onChange={(e) => onConfigUpdate({ defaultGameTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        )}
      </div>

      {/* Date Settings */}
      <div className="bg-white rounded-lg shadow">
        <button
          onClick={() => toggleSection('dates')}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50"
        >
          <h3 className="text-lg font-bold text-gray-900">Season Dates</h3>
          <span className="text-gray-600">{collapsedSections['dates'] ? '▼' : '▲'}</span>
        </button>

        {!collapsedSections['dates'] && (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Season Start</label>
              <input
                type="date"
                value={config.seasonStartDate}
                onChange={(e) => onConfigUpdate({ seasonStartDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Season End</label>
              <input
                type="date"
                value={config.seasonEndDate}
                onChange={(e) => onConfigUpdate({ seasonEndDate: e.target.value })}
                min={config.seasonStartDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Blackout Dates</label>

              {/* Date Range Picker */}
              <div className="flex gap-2 mb-2">
                <input
                  type="date"
                  value={blackoutRangeStart}
                  onChange={(e) => setBlackoutRangeStart(e.target.value)}
                  placeholder="Start"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={blackoutRangeEnd}
                  onChange={(e) => setBlackoutRangeEnd(e.target.value)}
                  placeholder="End"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={addBlackoutDateRange}
                  disabled={!blackoutRangeStart || !blackoutRangeEnd}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 text-sm"
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-2">Add date range or single date</p>

              {config.blackoutDates.length > 0 && (
                <>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded p-2 mb-2">
                    <div className="flex flex-wrap gap-1">
                      {config.blackoutDates.map((date) => (
                        <div key={date} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs">
                          <span>{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <button
                            onClick={() => onConfigUpdate({
                              blackoutDates: config.blackoutDates.filter(d => d !== date)
                            })}
                            className="text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={clearAllBlackoutDates}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Clear all ({config.blackoutDates.length})
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Playoff Settings */}
      <div className="bg-white rounded-lg shadow">
        <button
          onClick={() => toggleSection('playoffs')}
          className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50"
        >
          <h3 className="text-lg font-bold text-gray-900">Playoffs</h3>
          <span className="text-gray-600">{collapsedSections['playoffs'] ? '▼' : '▲'}</span>
        </button>

        {!collapsedSections['playoffs'] && (
          <div className="px-6 pb-6 space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={config.includePlayoffs}
                onChange={(e) => onConfigUpdate({
                  includePlayoffs: e.target.checked,
                  playoffFormat: e.target.checked ? config.playoffFormat : 'none'
                })}
                className="mr-2"
              />
              <label className="text-sm font-medium text-gray-700">Include Playoffs</label>
            </div>

            {config.includePlayoffs && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Playoff Format</label>
                <select
                  value={config.playoffFormat}
                  onChange={(e) => onConfigUpdate({ playoffFormat: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="championship">Championship (Top 2)</option>
                  <option value="top_4">Top 4 Bracket</option>
                  <option value="play_in">Play-In + Semifinals</option>
                  <option value="top_8">Top 8 Bracket</option>
                  <option value="division_winners">Division Winners</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {config.playoffFormat === 'championship' && 'Top 2 teams play championship game'}
                  {config.playoffFormat === 'top_4' && 'Top 4 teams: semifinals + championship'}
                  {config.playoffFormat === 'play_in' && 'Seeds 3-4 play-in, then semifinals + championship'}
                  {config.playoffFormat === 'top_8' && 'Top 8 teams: quarterfinals + semifinals + championship'}
                  {config.playoffFormat === 'division_winners' && 'Division winners compete for championship'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 mb-2">Schedule Summary</h3>
        <div className="space-y-1 text-sm text-blue-800">
          <div>Total Matches: <span className="font-bold">{schedule.length}</span></div>
          <div>Periods Needed: <span className="font-bold">{schedule.length > 0 ? Math.max(...schedule.map(m => m.weekNumber)) : 0}</span></div>
          <div>Total Slots: <span className="font-bold">
            {config.scheduleType === 'divisional'
              ? config.divisionsCount * config.teamsPerDivision
              : config.scheduleType === 'pool-only'
              ? config.poolsCount * config.teamsPerPool
              : config.divisionsCount * config.teamsPerDivision}
          </span></div>
          <div>Teams Assigned: <span className="font-bold">{teams.length}</span></div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={isSaving || hasErrors}
        className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {isSaving ? 'Saving...' : 'Save Schedule'}
      </button>
    </div>
  );
}
