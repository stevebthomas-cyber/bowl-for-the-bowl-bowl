/**
 * SettingsPanel Component
 *
 * Schedule settings configuration panel.
 * Auto-saves all changes to the league settings.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabase';

interface SettingsPanelProps {
  leagueId: string;
}

interface LeagueSettings {
  min_teams: number | null;
  max_teams: number | null;
  games_per_season: number | null;
  divisions: number | null;
  current_season_start: string | null;
  current_season_end: string | null;
  season_number: number;
}

export default function SettingsPanel({ leagueId }: SettingsPanelProps) {
  const [settings, setSettings] = useState<LeagueSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [leagueId]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('leagues')
        .select('min_teams, max_teams, games_per_season, divisions, current_season_start, current_season_end, season_number')
        .eq('id', leagueId)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (field: keyof LeagueSettings, value: any) => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('leagues')
        .update({ [field]: value })
        .eq('id', leagueId);

      if (error) throw error;

      setSettings({ ...settings, [field]: value });
    } catch (err) {
      console.error('Error updating setting:', err);
      alert('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!settings) return;

    if (!confirm('Delete all scheduled matches for this season? This action is permanent and cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('league_id', leagueId)
        .eq('season_number', settings.season_number);

      if (error) throw error;

      alert('Schedule deleted successfully');
      window.location.reload();
    } catch (err) {
      console.error('Error deleting schedule:', err);
      alert('Failed to delete schedule');
    }
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500 py-2">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="text-sm text-red-600 py-2">Failed to load settings</div>;
  }

  return (
    <div className="space-y-4">
      {isSaving && (
        <div className="text-xs text-blue-600 italic">Saving...</div>
      )}

      {/* Number of Teams */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Number of Teams
        </label>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Min</label>
            <input
              type="number"
              min="2"
              value={settings.min_teams || ''}
              onChange={(e) => updateSetting('min_teams', parseInt(e.target.value) || null)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 mb-1">Max</label>
            <input
              type="number"
              min={settings.min_teams || 2}
              value={settings.max_teams || ''}
              onChange={(e) => updateSetting('max_teams', parseInt(e.target.value) || null)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
            />
          </div>
        </div>
      </div>

      {/* Games per Team */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Games per Team
        </label>
        <input
          type="number"
          min="1"
          value={settings.games_per_season || ''}
          onChange={(e) => updateSetting('games_per_season', parseInt(e.target.value) || null)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
          placeholder="e.g., 10"
        />
      </div>

      {/* Number of Divisions */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Number of Divisions
        </label>
        <input
          type="number"
          min="1"
          value={settings.divisions || 1}
          onChange={(e) => updateSetting('divisions', parseInt(e.target.value) || 1)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Season Start Date
        </label>
        <input
          type="date"
          value={settings.current_season_start ? settings.current_season_start.split('T')[0] : ''}
          onChange={(e) => updateSetting('current_season_start', e.target.value ? new Date(e.target.value).toISOString() : null)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>

      {/* End Date */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Season End Date
        </label>
        <input
          type="date"
          value={settings.current_season_end ? settings.current_season_end.split('T')[0] : ''}
          onChange={(e) => updateSetting('current_season_end', e.target.value ? new Date(e.target.value).toISOString() : null)}
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
        />
      </div>

      {/* Delete Schedule Button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleDeleteSchedule}
          className="w-full px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-700 transition-colors"
        >
          DELETE SCHEDULE
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          This action is permanent and cannot be undone
        </p>
      </div>
    </div>
  );
}
