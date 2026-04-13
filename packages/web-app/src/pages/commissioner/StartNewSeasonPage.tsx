import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { useLeague } from '../../hooks/useLeague';
import { archiveEntireSeason } from '../../lib/season-archive';
import CommissionerLayout from '../../components/layouts/CommissionerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';

type Step = 'warning' | 'confirm' | 'archiving' | 'resetting' | 'complete';

export default function StartNewSeasonPage() {
  const navigate = useNavigate();
  const { league, isLoading: leagueLoading } = useLeague();

  const [currentStep, setCurrentStep] = useState<Step>('warning');
  const [error, setError] = useState<string | null>(null);
  const [teamsCount, setTeamsCount] = useState(0);
  const [confirmText, setConfirmText] = useState('');
  const [archiveProgress, setArchiveProgress] = useState(0);

  useEffect(() => {
    async function fetchTeamsCount() {
      if (!league) return;
      const { data, error } = await supabase
        .from('teams')
        .select('id', { count: 'exact', head: true })
        .eq('league_id', league.id);

      if (!error && data) {
        setTeamsCount(data.length || 0);
      }
    }

    fetchTeamsCount();
  }, [league]);

  const handleStartProcess = () => {
    setCurrentStep('confirm');
  };

  const handleConfirmArchive = async () => {
    if (confirmText.toLowerCase() !== 'archive season') {
      setError('Please type "ARCHIVE SEASON" to confirm');
      return;
    }

    if (!league) {
      setError('League not found');
      return;
    }

    try {
      setError(null);
      setCurrentStep('archiving');
      setArchiveProgress(0);

      // Archive the entire season
      const currentSeasonNumber = league.season_number || 1;
      await archiveEntireSeason(league.id, currentSeasonNumber);

      setArchiveProgress(50);
      setCurrentStep('resetting');

      // Reset league state
      await resetLeagueForNewSeason(league.id, currentSeasonNumber);

      setArchiveProgress(100);
      setCurrentStep('complete');
    } catch (err) {
      console.error('Error archiving season:', err);
      setError(err instanceof Error ? err.message : 'Failed to archive season');
      setCurrentStep('confirm');
    }
  };

  const resetLeagueForNewSeason = async (leagueId: string, currentSeasonNumber: number) => {
    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id')
      .eq('league_id', leagueId);

    if (teamsError) throw teamsError;

    // Reset all teams: wins, losses, ties, league_points to 0
    const { error: resetTeamsError } = await supabase
      .from('teams')
      .update({
        wins: 0,
        losses: 0,
        ties: 0,
        league_points: 0
      })
      .eq('league_id', leagueId);

    if (resetTeamsError) throw resetTeamsError;

    // Reset all players: clear miss_next_game
    const { error: resetPlayersError } = await supabase
      .from('players')
      .update({
        miss_next_game: false
      })
      .in('team_id', teams?.map(t => t.id) || []);

    if (resetPlayersError) throw resetPlayersError;

    // Delete all matches (regular season and playoffs)
    const { error: deleteMatchesError } = await supabase
      .from('matches')
      .delete()
      .eq('league_id', leagueId);

    if (deleteMatchesError) throw deleteMatchesError;

    // Increment season number and set status to 'setup'
    const { error: updateLeagueError } = await supabase
      .from('leagues')
      .update({
        season_number: currentSeasonNumber + 1,
        season_status: 'setup'
      })
      .eq('id', leagueId);

    if (updateLeagueError) throw updateLeagueError;
  };

  if (leagueLoading) {
    return (
      <CommissionerLayout>
        <LoadingSpinner message="Loading league data..." />
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Start New Season</h1>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} />
          </div>
        )}

        {currentStep === 'warning' && (
          <div className="bg-red-50 border-2 border-red-500 rounded-lg p-8">
            <div className="text-6xl mb-4 text-center">⚠️</div>
            <h2 className="text-2xl font-bold text-red-900 mb-4 text-center">
              CRITICAL WARNING
            </h2>

            <div className="space-y-4 text-red-900 mb-6">
              <p className="font-semibold text-lg">
                Starting a new season will:
              </p>

              <ul className="list-disc pl-6 space-y-2">
                <li>Archive all current season data to JSON blobs for historical records</li>
                <li>Reset ALL team records (Wins, Losses, Ties, League Points) to 0</li>
                <li>Delete ALL matches (regular season and playoffs)</li>
                <li>Clear all "miss next game" flags from players</li>
                <li>Increment the season number to {(league.season_number || 1) + 1}</li>
                <li>Set league status to "setup"</li>
              </ul>

              <p className="font-semibold text-lg mt-6">
                The following will be PRESERVED:
              </p>

              <ul className="list-disc pl-6 space-y-2">
                <li>All teams and their rosters</li>
                <li>Player stats (TDs, Casualties, SPP, etc.)</li>
                <li>Team treasury and dedicated fans</li>
                <li>Player skills and injuries</li>
                <li>Staff (coaches, cheerleaders, apothecaries)</li>
              </ul>

              <div className="bg-red-100 border border-red-600 rounded p-4 mt-6">
                <p className="font-bold text-center">
                  THIS ACTION CANNOT BE UNDONE!
                </p>
                <p className="text-center mt-2">
                  Current season data will be archived as read-only records.
                </p>
              </div>
            </div>

            <div className="bg-white rounded p-4 mb-6">
              <p className="text-gray-900 font-semibold mb-2">Current Season Summary:</p>
              <ul className="text-gray-700 space-y-1">
                <li>Season Number: {league.season_number || 1}</li>
                <li>Status: {league.season_status}</li>
                <li>Teams: {teamsCount}</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => navigate('/commissioner')}
                className="flex-1 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel - Go Back
              </button>
              <button
                onClick={handleStartProcess}
                className="flex-1 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
              >
                I Understand - Continue
              </button>
            </div>
          </div>
        )}

        {currentStep === 'confirm' && (
          <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-yellow-900 mb-6 text-center">
              Final Confirmation Required
            </h2>

            <p className="text-yellow-900 mb-6">
              Before proceeding with archival and reset, please confirm your action by typing:
            </p>

            <div className="bg-yellow-100 border border-yellow-600 rounded p-4 mb-6">
              <p className="font-mono font-bold text-center text-xl">
                ARCHIVE SEASON
              </p>
            </div>

            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type here to confirm..."
              className="w-full px-4 py-3 border-2 border-yellow-500 rounded-lg mb-6 font-mono text-lg"
            />

            <div className="flex gap-4">
              <button
                onClick={() => setCurrentStep('warning')}
                className="flex-1 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmArchive}
                disabled={confirmText.toLowerCase() !== 'archive season'}
                className="flex-1 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Archive and Reset Season
              </button>
            </div>
          </div>
        )}

        {currentStep === 'archiving' && (
          <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-blue-900 mb-6 text-center">
              Archiving Season Data...
            </h2>

            <div className="mb-6">
              <LoadingSpinner message="Creating JSON archives for all teams..." />
            </div>

            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${archiveProgress}%` }}
              />
            </div>

            <p className="text-center text-blue-900">
              Please wait while we archive the current season...
            </p>
          </div>
        )}

        {currentStep === 'resetting' && (
          <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-blue-900 mb-6 text-center">
              Resetting League for New Season...
            </h2>

            <div className="mb-6">
              <LoadingSpinner message="Resetting team records and clearing matches..." />
            </div>

            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${archiveProgress}%` }}
              />
            </div>

            <p className="text-center text-blue-900">
              Almost done...
            </p>
          </div>
        )}

        {currentStep === 'complete' && (
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-8">
            <div className="text-6xl mb-4 text-center">✓</div>
            <h2 className="text-2xl font-bold text-green-900 mb-6 text-center">
              New Season Started Successfully!
            </h2>

            <div className="bg-white rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">What Happened:</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  Season {league.season_number || 1} data archived for all teams
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  All team records reset to 0-0-0
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  All matches cleared
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  Season number incremented to {(league.season_number || 1) + 1}
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  League status set to "setup"
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-300 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
              <ul className="space-y-2 text-blue-800">
                <li>1. Notify all coaches that the new season has started</li>
                <li>2. Coaches should complete their re-up process</li>
                <li>3. Review and update league settings if needed</li>
                <li>4. Create the new season schedule when ready</li>
              </ul>
            </div>

            <button
              onClick={() => {
                window.location.reload();
              }}
              className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Return to Commissioner Dashboard
            </button>
          </div>
        )}
      </div>
    </CommissionerLayout>
  );
}
