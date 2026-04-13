import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeague } from '../../hooks/useLeague';
import { supabase } from '../../config/supabase';
import CommissionerLayout from '../../components/layouts/CommissionerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import ConfigurationPanel from '../../components/schedule-builder/ConfigurationPanel';
import ValidationPanel from '../../components/schedule-builder/ValidationPanel';
import EmptyStateView from '../../components/schedule-builder/EmptyStateView';
import ScheduleManagementView from '../../components/schedule-builder/ScheduleManagementView';
import { generateSchedule } from '../../lib/schedule/generators';
import type { Team, ScheduleConfig, ScheduledMatch, ValidationIssue } from '../../types/schedule';

export default function ScheduleBuilderPage() {
  const navigate = useNavigate();
  const { league, isLoading: leagueLoading } = useLeague();
  const [teams, setTeams] = useState<Team[]>([]);
  const [config, setConfig] = useState<ScheduleConfig>({
    scheduleType: 'divisional',
    divisionsCount: 2,
    teamsPerDivision: 4,
    intraDivisionGames: 2,
    interDivisionGames: 1,
    targetGamesPerTeam: 10,
    poolsCount: 2,
    teamsPerPool: 4,
    gamesPerTeamInPool: 3,
    schedulingPeriod: 'weekly',
    customDaysBetween: 7,
    gameDays: [3], // Wednesday
    gamesPerMeetup: 1,
    matchesPerDay: 4,
    defaultGameTime: '19:00',
    seasonStartDate: new Date().toISOString().split('T')[0],
    seasonEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    blackoutDates: [],
    includePlayoffs: false,
    playoffFormat: 'none',
  });
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load teams
  useEffect(() => {
    async function loadTeams() {
      if (!league) return;

      const { data, error } = await supabase
        .from('teams')
        .select('id, name, division')
        .eq('league_id', league.id)
        .eq('active', true)
        .is('deleted_at', null)
        .order('division', { ascending: true })
        .order('name', { ascending: true });

      if (!error && data) {
        setTeams(data);
      }
    }

    loadTeams();
  }, [league]);

  // Initialize playoff settings from league
  useEffect(() => {
    if (!league) return;

    const playoffFormat = (league.playoff_format || 'none') as ScheduleConfig['playoffFormat'];
    updateConfig({
      playoffFormat,
      includePlayoffs: playoffFormat !== 'none',
    });
  }, [league]);

  // Auto-generate schedule whenever config changes
  useEffect(() => {
    if (!league) return;

    const { schedule: newSchedule, issues } = generateSchedule(config, teams);
    setSchedule(newSchedule);
    setValidationIssues(issues);
  }, [config, teams, league]);

  const updateConfig = (updates: Partial<ScheduleConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    if (!league || schedule.length === 0) return;

    setIsSaving(true);

    try {
      // Delete existing matches
      await supabase
        .from('matches')
        .delete()
        .eq('league_id', league.id)
        .eq('season_number', league.season_number);

      // Insert new matches
      const matchInserts = schedule.map(match => ({
        league_id: league.id,
        season_number: league.season_number,
        match_number: match.matchNumber,
        // Use slot as team ID if it's a UUID, otherwise leave null
        home_team_id: match.homeSlot.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? match.homeSlot : null,
        away_team_id: match.awaySlot.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? match.awaySlot : null,
        // Store slot identifiers in metadata
        metadata: {
          homeSlot: match.homeSlot,
          awaySlot: match.awaySlot,
          matchType: match.matchType,
        },
        scheduled_date: match.scheduledDate ? `${match.scheduledDate}T${config.defaultGameTime}:00` : null,
        week_number: match.weekNumber,
        status: 'scheduled',
      }));

      const { error } = await supabase
        .from('matches')
        .insert(matchInserts);

      if (error) throw error;

      // Update league playoff format if changed
      if (league.playoff_format !== config.playoffFormat) {
        const { error: leagueError } = await supabase
          .from('leagues')
          .update({ playoff_format: config.playoffFormat })
          .eq('id', league.id);

        if (leagueError) throw leagueError;
      }

      // Success - navigate back to schedule page
      navigate('/commissioner/schedule');
    } catch (err) {
      console.error('Error saving schedule:', err);
      alert('Failed to save schedule: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
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

  const hasErrors = validationIssues.some(issue => issue.type === 'error');

  return (
    <CommissionerLayout>
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Schedule Builder</h1>
          <button
            onClick={() => navigate('/commissioner/schedule')}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel: Configuration */}
          <ConfigurationPanel
            config={config}
            teams={teams}
            schedule={schedule}
            onConfigUpdate={updateConfig}
            onSave={handleSave}
            isSaving={isSaving}
            hasErrors={hasErrors}
          />

          {/* Right Panel: Two-Mode Interface */}
          <div className="lg:col-span-2">
            {/* Validation Issues (show above both modes) */}
            {validationIssues.length > 0 && schedule.length > 0 && (
              <div className="mb-4">
                <ValidationPanel issues={validationIssues} />
              </div>
            )}

            {/* Mode switching: Empty State vs Management View */}
            {schedule.length === 0 ? (
              <EmptyStateView onConfigUpdate={updateConfig} />
            ) : (
              <ScheduleManagementView schedule={schedule} config={config} />
            )}
          </div>
        </div>
      </div>
    </CommissionerLayout>
  );
}
