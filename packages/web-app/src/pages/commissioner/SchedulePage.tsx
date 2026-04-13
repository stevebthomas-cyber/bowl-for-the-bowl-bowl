import { useState, useEffect } from 'react';
import { useLeague } from '../../hooks/useLeague';
import { supabase } from '../../config/supabase';
import CommissionerLayout from '../../components/layouts/CommissionerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';
import ScheduleMakerMode from '../../components/schedule/ScheduleMakerMode';
import ScheduleViewingMode from '../../components/schedule/ScheduleViewingMode';

type ViewMode = 'maker' | 'viewing';

export default function SchedulePage() {
  const { league, isLoading: leagueLoading, refreshLeague } = useLeague();
  const [existingMatches, setExistingMatches] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('maker');
  const [readyingSchedule, setReadyingSchedule] = useState(false);

  const loadData = async () => {
    if (!league) return;

    try {
      // Load existing matches with coach information
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          match_number,
          scheduled_date,
          week_number,
          home_team_id,
          away_team_id,
          venue_id,
          pitch_id,
          match_type,
          metadata,
          home_team:teams!matches_home_team_id_fkey(
            id,
            name,
            team_ownership!team_ownership_team_id_fkey(
              user_id,
              owner:users!team_ownership_user_id_fkey(
                display_name
              )
            )
          ),
          away_team:teams!matches_away_team_id_fkey(
            id,
            name,
            team_ownership!team_ownership_team_id_fkey(
              user_id,
              owner:users!team_ownership_user_id_fkey(
                display_name
              )
            )
          ),
          venue:venues(name),
          pitch:pitches(name)
        `)
        .eq('league_id', league.id)
        .eq('season_number', league.season_number)
        .order('match_number', { ascending: true });

      if (matchesError) throw matchesError;
      setExistingMatches(matchesData || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load teams and schedule');
    }
  };

  useEffect(() => {
    loadData();
  }, [league]);

  const handleReadySchedule = async () => {
    if (!league) return;

    setReadyingSchedule(true);
    try {
      const { error } = await supabase
        .from('leagues')
        .update({ schedule_ready: true })
        .eq('id', league.id);

      if (error) throw error;

      await refreshLeague();
      alert('Schedule marked as ready! You can now activate the season.');
    } catch (err) {
      console.error('Error marking schedule as ready:', err);
      setError('Failed to mark schedule as ready');
    } finally {
      setReadyingSchedule(false);
    }
  };

  const handleUnreadySchedule = async () => {
    if (!league) return;

    setReadyingSchedule(true);
    try {
      const { error } = await supabase
        .from('leagues')
        .update({ schedule_ready: false })
        .eq('id', league.id);

      if (error) throw error;

      await refreshLeague();
    } catch (err) {
      console.error('Error unmarking schedule:', err);
      setError('Failed to unmark schedule');
    } finally {
      setReadyingSchedule(false);
    }
  };

  if (leagueLoading) {
    return (
      <CommissionerLayout>
        <LoadingSpinner message="Loading schedule..." />
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
      <div className="space-y-6">
        {/* Header with mode toggle */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{league.name}</h1>
            <div className="text-sm text-gray-600 mt-1">
              Season {league.season_number} - {league.season_status}
              {league.schedule_ready && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                  Schedule Ready
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('maker')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'maker'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Maker Mode
            </button>
            <button
              onClick={() => setViewMode('viewing')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'viewing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Viewing Mode
            </button>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}

        {/* Two-mode interface */}
        {viewMode === 'maker' ? (
          <ScheduleMakerMode
            matches={existingMatches}
            leagueName={league.name}
            seasonNumber={league.season_number}
            leagueId={league.id}
            onDataChanged={loadData}
          />
        ) : (
          <ScheduleViewingMode
            matches={existingMatches}
            leagueName={league.name}
            seasonNumber={league.season_number}
          />
        )}
      </div>

      {/* Floating Ready Schedule Button */}
      {league.season_status === 'setup' && existingMatches.length > 0 && (
        <div className="fixed bottom-8 right-8">
          {league.schedule_ready ? (
            <button
              onClick={handleUnreadySchedule}
              disabled={readyingSchedule}
              className="px-6 py-3 bg-yellow-600 text-white font-bold rounded-lg shadow-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {readyingSchedule ? 'Updating...' : 'Unmark Schedule'}
            </button>
          ) : (
            <button
              onClick={handleReadySchedule}
              disabled={readyingSchedule}
              className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {readyingSchedule ? 'Marking Ready...' : 'Ready Schedule'}
            </button>
          )}
        </div>
      )}
    </CommissionerLayout>
  );
}
