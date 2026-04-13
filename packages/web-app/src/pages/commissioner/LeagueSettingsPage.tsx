import { useState, useEffect } from 'react';
import { useLeague } from '../../hooks/useLeague';
import { supabase } from '../../config/supabase';
import CommissionerLayout from '../../components/layouts/CommissionerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';

type PlayoffFormat = 'none' | 'championship' | 'top_4' | 'play_in' | 'top_8' | 'division_winners';

interface LeagueSettings {
  max_teams: number;
  min_teams: number;
  divisions: number;
  games_per_season: number;
  win_points: number;
  tie_points: number;
  loss_points: number;
  attendance_threshold: number;
  playoff_format: PlayoffFormat;
  playoff_seeding: 'by_points' | 'by_division';
  home_advantage: boolean;
  starting_team_value: number;
  sob_enabled: boolean;
  weather_enabled: boolean;
  kickoff_events_enabled: boolean;
  sudden_death_to_spp: boolean;
}

export default function LeagueSettingsPage() {
  const { league, isLoading: leagueLoading } = useLeague();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [maxGamesPlayed, setMaxGamesPlayed] = useState(0);

  const [formData, setFormData] = useState<LeagueSettings>({
    max_teams: 8,
    min_teams: 4,
    divisions: 2,
    games_per_season: 10,
    win_points: 3,
    tie_points: 1,
    loss_points: 0,
    attendance_threshold: 0.20,
    playoff_format: 'top_4',
    playoff_seeding: 'by_points',
    home_advantage: false,
    starting_team_value: 1000000,
    sob_enabled: false,
    weather_enabled: false,
    kickoff_events_enabled: false,
    sudden_death_to_spp: false,
  });

  // Load league data into form
  useEffect(() => {
    if (league?.rules_config) {
      const config = league.rules_config;
      setFormData({
        max_teams: config.max_teams || 8,
        min_teams: config.min_teams || 4,
        divisions: config.divisions || 2,
        games_per_season: config.games_per_season || 10,
        win_points: config.scoring?.win || 3,
        tie_points: config.scoring?.tie || 1,
        loss_points: config.scoring?.loss || 0,
        attendance_threshold: config.attendance_threshold || 0.20,
        playoff_format: config.playoff_format?.type || 'top_4',
        playoff_seeding: config.playoff_format?.seeding || 'by_points',
        home_advantage: config.playoff_format?.home_advantage || false,
        starting_team_value: config.starting_team_value || 1000000,
        sob_enabled: config.optional_rules?.sob_enabled || false,
        weather_enabled: config.optional_rules?.weather_enabled || false,
        kickoff_events_enabled: config.optional_rules?.kickoff_events_enabled || false,
        sudden_death_to_spp: config.sudden_death_to_spp || false,
      });
    }
  }, [league]);

  // Fetch max games played by any team
  useEffect(() => {
    async function fetchMaxGames() {
      if (!league) return;

      const { data: teams } = await supabase
        .from('teams')
        .select('wins, losses, ties')
        .eq('league_id', league.id)
        .is('deleted_at', null);

      if (teams && teams.length > 0) {
        const maxGames = Math.max(...teams.map(t => (t.wins || 0) + (t.losses || 0) + (t.ties || 0)));
        setMaxGamesPlayed(maxGames);
      }
    }

    fetchMaxGames();
  }, [league]);

  const updateFormData = (updates: Partial<LeagueSettings>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    if (!league) return;

    // Validation
    if (formData.games_per_season < maxGamesPlayed) {
      setError(`Cannot reduce games per season below ${maxGamesPlayed} (current max games played by any team)`);
      return;
    }

    if (formData.min_teams > formData.max_teams) {
      setError('Minimum teams cannot exceed maximum teams');
      return;
    }

    if (formData.starting_team_value < 1000000) {
      setError('Starting team value must be at least 1,000,000 gold');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Calculate playoff teams count
      const playoffTeamsMap: Record<PlayoffFormat, number> = {
        none: 0,
        championship: 2,
        top_4: 4,
        play_in: 4,
        top_8: 8,
        division_winners: formData.divisions,
      };

      const { error: updateError } = await supabase
        .from('leagues')
        .update({
          playoff_format: formData.playoff_format, // Save to top-level column for schedule builder
          playoff_seeding: formData.playoff_seeding,
          home_advantage: formData.home_advantage,
          rules_config: {
            max_teams: formData.max_teams,
            min_teams: formData.min_teams,
            divisions: formData.divisions,
            games_per_season: formData.games_per_season,
            attendance_threshold: formData.attendance_threshold,
            scoring: {
              win: formData.win_points,
              tie: formData.tie_points,
              loss: formData.loss_points,
            },
            playoff_format: {
              type: formData.playoff_format,
              teams_count: playoffTeamsMap[formData.playoff_format],
              seeding: formData.playoff_seeding,
              home_advantage: formData.home_advantage,
            },
            starting_team_value: formData.starting_team_value,
            optional_rules: {
              sob_enabled: formData.sob_enabled,
              weather_enabled: formData.weather_enabled,
              kickoff_events_enabled: formData.kickoff_events_enabled,
            },
            sudden_death_to_spp: formData.sudden_death_to_spp,
          },
        })
        .eq('id', league.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      setIsEditing(false);

      // Reload league data
      window.location.reload();
    } catch (err) {
      console.error('Error updating league:', err);
      setError(err instanceof Error ? err.message : 'Failed to update league settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (leagueLoading || !league) return <LoadingSpinner />;

  if (isSaving) return <LoadingSpinner message="Saving settings..." />;

  return (
    <CommissionerLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">League Settings</h1>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Edit Settings
            </button>
          )}
        </div>

        {error && <ErrorMessage message={error} />}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">Settings updated successfully!</p>
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6">
          {/* Basic Info (Read-only) */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">League Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">League Name</label>
                <p className="text-gray-900">{league.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Current Season</label>
                <p className="text-gray-900">
                  Season {league.season_number} ({league.season_status})
                </p>
              </div>
            </div>
          </div>

          {/* League Structure */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">League Structure</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Teams
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    min="2"
                    max="16"
                    value={formData.max_teams}
                    onChange={(e) => updateFormData({ max_teams: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.max_teams}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Teams
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    min="2"
                    max={formData.max_teams}
                    value={formData.min_teams}
                    onChange={(e) => updateFormData({ min_teams: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.min_teams}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Divisions
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={formData.divisions}
                    onChange={(e) => updateFormData({ divisions: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.divisions}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Games per Season
                </label>
                {isEditing ? (
                  <>
                    <input
                      type="number"
                      min={maxGamesPlayed}
                      max="20"
                      value={formData.games_per_season}
                      onChange={(e) => updateFormData({ games_per_season: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    {maxGamesPlayed > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Minimum: {maxGamesPlayed} (current max games played)
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-900">{formData.games_per_season}</p>
                )}
              </div>
            </div>
          </div>

          {/* Scoring */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Scoring Rules</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Win Points</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={formData.win_points}
                    onChange={(e) => updateFormData({ win_points: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.win_points}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tie Points</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={formData.tie_points}
                    onChange={(e) => updateFormData({ tie_points: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.tie_points}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Loss Points</label>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={formData.loss_points}
                    onChange={(e) => updateFormData({ loss_points: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{formData.loss_points}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attendance Threshold
              </label>
              {isEditing ? (
                <>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={formData.attendance_threshold}
                    onChange={(e) => updateFormData({ attendance_threshold: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {(formData.attendance_threshold * 100).toFixed(0)}% of games required
                  </p>
                </>
              ) : (
                <p className="text-gray-900">{(formData.attendance_threshold * 100).toFixed(0)}%</p>
              )}
            </div>
          </div>

          {/* Financial */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Settings</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Starting Team Value
              </label>
              {isEditing ? (
                <>
                  <input
                    type="number"
                    min="1000000"
                    step="10000"
                    value={formData.starting_team_value}
                    onChange={(e) => updateFormData({ starting_team_value: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.starting_team_value.toLocaleString()}g (minimum: 1,000,000g)
                  </p>
                </>
              ) : (
                <p className="text-gray-900">{formData.starting_team_value.toLocaleString()}g</p>
              )}
            </div>
          </div>

          {/* Optional Rules */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Optional Rules</h2>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.sob_enabled}
                  onChange={(e) => updateFormData({ sob_enabled: e.target.checked })}
                  disabled={!isEditing}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">SOB (Secret Objective Bonuses) Enabled</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.weather_enabled}
                  onChange={(e) => updateFormData({ weather_enabled: e.target.checked })}
                  disabled={!isEditing}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Weather Effects Enabled</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.kickoff_events_enabled}
                  onChange={(e) => updateFormData({ kickoff_events_enabled: e.target.checked })}
                  disabled={!isEditing}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Kick-off Events Enabled</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.sudden_death_to_spp}
                  onChange={(e) => updateFormData({ sudden_death_to_spp: e.target.checked })}
                  disabled={!isEditing}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Sudden Death counts toward SPP</span>
              </label>
            </div>
          </div>

          {/* Playoff Format */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Playoff Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                {isEditing ? (
                  <select
                    value={formData.playoff_format}
                    onChange={(e) => updateFormData({ playoff_format: e.target.value as PlayoffFormat })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="none">No Playoffs</option>
                    <option value="championship">Championship (Top 2)</option>
                    <option value="top_4">Top 4 Bracket</option>
                    <option value="play_in">Play-In + Semifinals</option>
                    <option value="top_8">Top 8 Bracket</option>
                    <option value="division_winners">Division Winners</option>
                  </select>
                ) : (
                  <p className="text-gray-900 capitalize">{formData.playoff_format.replace('_', ' ')}</p>
                )}
              </div>

              {formData.playoff_format !== 'none' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Seeding</label>
                    {isEditing ? (
                      <select
                        value={formData.playoff_seeding}
                        onChange={(e) => updateFormData({ playoff_seeding: e.target.value as 'by_points' | 'by_division' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="by_points">By League Points</option>
                        <option value="by_division">By Division</option>
                      </select>
                    ) : (
                      <p className="text-gray-900">
                        {formData.playoff_seeding === 'by_points' ? 'By League Points' : 'By Division'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.home_advantage}
                        onChange={(e) => updateFormData({ home_advantage: e.target.checked })}
                        disabled={!isEditing}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Home Field Advantage (higher seed gets home field)</span>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setError(null);
                  window.location.reload();
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </CommissionerLayout>
  );
}
