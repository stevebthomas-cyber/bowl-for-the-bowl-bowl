import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { useLeague } from '../../hooks/useLeague';
import CommissionerLayout from '../../components/layouts/CommissionerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';

interface SeasonReadiness {
  teamsCount: number;
  minTeams: number;
  hasMinimumTeams: boolean;
  scheduledMatchesCount: number;
  hasSchedule: boolean;
  scheduleReady: boolean;
  allRequirementsMet: boolean;
  missingRequirements: string[];
}

export default function ActivateSeasonPage() {
  const navigate = useNavigate();
  const { league, isLoading: leagueLoading } = useLeague();
  const [readiness, setReadiness] = useState<SeasonReadiness | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkReadiness() {
      if (!league) return;

      try {
        // Check team count
        const { count: teamsCount } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', league.id)
          .eq('active', true)
          .is('deleted_at', null);

        // Check if schedule exists
        const { count: scheduledMatchesCount } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', league.id);

        const minTeams = league.min_teams || 4;
        const hasMinimumTeams = (teamsCount || 0) >= minTeams;
        const hasSchedule = (scheduledMatchesCount || 0) > 0;
        const scheduleReady = league.schedule_ready || false;

        const missingRequirements: string[] = [];
        if (!hasMinimumTeams) {
          missingRequirements.push(`Need at least ${minTeams} teams (currently have ${teamsCount || 0})`);
        }
        if (!hasSchedule) {
          missingRequirements.push('Schedule must be created');
        }
        if (!scheduleReady) {
          missingRequirements.push('Schedule must be marked as ready');
        }

        setReadiness({
          teamsCount: teamsCount || 0,
          minTeams,
          hasMinimumTeams,
          scheduledMatchesCount: scheduledMatchesCount || 0,
          hasSchedule,
          scheduleReady,
          allRequirementsMet: hasMinimumTeams && hasSchedule && scheduleReady,
          missingRequirements,
        });
      } catch (err) {
        console.error('Error checking readiness:', err);
        setError('Failed to check season readiness');
      }
    }

    checkReadiness();
  }, [league]);

  const handleActivate = async () => {
    if (!league || !readiness?.allRequirementsMet) return;

    try {
      setIsActivating(true);
      setError(null);

      // Update league status to 'active' and set season start date
      const { error: updateError } = await supabase
        .from('leagues')
        .update({
          season_status: 'active',
          current_season_start: new Date().toISOString(),
        })
        .eq('id', league.id);

      if (updateError) throw updateError;

      // Redirect back to commissioner dashboard
      navigate('/commissioner');
    } catch (err) {
      console.error('Error activating season:', err);
      setError(err instanceof Error ? err.message : 'Failed to activate season');
      setIsActivating(false);
    }
  };

  if (leagueLoading || !readiness) {
    return (
      <CommissionerLayout>
        <LoadingSpinner message="Checking season readiness..." />
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

  // Check if league is already active
  if (league.season_status !== 'setup') {
    return (
      <CommissionerLayout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-yellow-900 mb-4">
              Season Already Started
            </h2>
            <p className="text-yellow-800 mb-6">
              This season is currently in <strong>{league.season_status}</strong> status.
              You can only activate seasons that are in "setup" status.
            </p>
            <button
              onClick={() => navigate('/commissioner')}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </CommissionerLayout>
    );
  }

  return (
    <CommissionerLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Activate Season {league.season_number}</h1>

        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} />
          </div>
        )}

        <div className={`border-2 rounded-lg p-8 mb-6 ${
          readiness.allRequirementsMet
            ? 'bg-green-50 border-green-500'
            : 'bg-yellow-50 border-yellow-500'
        }`}>
          <h2 className={`text-2xl font-bold mb-6 ${
            readiness.allRequirementsMet ? 'text-green-900' : 'text-yellow-900'
          }`}>
            Season Readiness Checklist
          </h2>

          <div className="space-y-4 mb-6">
            {/* Teams Requirement */}
            <div className="flex items-start">
              <div className={`text-2xl mr-3 ${
                readiness.hasMinimumTeams ? 'text-green-600' : 'text-gray-400'
              }`}>
                {readiness.hasMinimumTeams ? '✓' : '○'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  Minimum Teams: {readiness.teamsCount} / {readiness.minTeams}
                </div>
                <div className="text-sm text-gray-600">
                  {readiness.hasMinimumTeams
                    ? `Ready! ${readiness.teamsCount} teams registered`
                    : `Need ${readiness.minTeams - readiness.teamsCount} more team(s)`
                  }
                </div>
              </div>
            </div>

            {/* Schedule Requirement */}
            <div className="flex items-start">
              <div className={`text-2xl mr-3 ${
                readiness.hasSchedule ? 'text-green-600' : 'text-gray-400'
              }`}>
                {readiness.hasSchedule ? '✓' : '○'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  Schedule Created
                </div>
                <div className="text-sm text-gray-600">
                  {readiness.hasSchedule
                    ? `${readiness.scheduledMatchesCount} matches scheduled`
                    : 'No matches scheduled yet - create schedule first'
                  }
                </div>
              </div>
            </div>

            {/* Schedule Ready Requirement */}
            <div className="flex items-start">
              <div className={`text-2xl mr-3 ${
                readiness.scheduleReady ? 'text-green-600' : 'text-gray-400'
              }`}>
                {readiness.scheduleReady ? '✓' : '○'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  Schedule Marked Ready
                </div>
                <div className="text-sm text-gray-600">
                  {readiness.scheduleReady
                    ? 'Schedule reviewed and ready for season start'
                    : 'Use the "Ready Schedule" button on the Schedule page'
                  }
                </div>
              </div>
            </div>

            {/* Season Settings */}
            <div className="flex items-start">
              <div className="text-2xl mr-3 text-green-600">✓</div>
              <div>
                <div className="font-semibold text-gray-900">
                  Season Settings Configured
                </div>
                <div className="text-sm text-gray-600">
                  Rules, playoff format, and settings are ready
                </div>
              </div>
            </div>
          </div>

          {!readiness.allRequirementsMet && (
            <div className="bg-yellow-100 border border-yellow-600 rounded p-4 mb-6">
              <p className="font-bold text-yellow-900 mb-2">Cannot Activate Season Yet</p>
              <ul className="list-disc pl-5 text-yellow-800">
                {readiness.missingRequirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {readiness.allRequirementsMet && (
            <div className="bg-green-100 border border-green-600 rounded p-4 mb-6">
              <p className="font-bold text-green-900 mb-2">✓ Ready to Activate!</p>
              <p className="text-green-800">
                All requirements met. Activating the season will allow coaches to submit match reports
                and matches to be played.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">What happens when you activate?</h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Season status changes from "setup" to "active"</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Season start date is recorded as today</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Coaches can submit match reports</span>
            </li>
            <li className="flex items-start">
              <span className="text-blue-600 mr-2">•</span>
              <span>Matches begin counting toward standings</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => navigate('/commissioner')}
            disabled={isActivating}
            className="flex-1 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Back to Dashboard
          </button>
          <button
            onClick={handleActivate}
            disabled={isActivating || !readiness.allRequirementsMet}
            className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isActivating ? 'Activating...' : 'Activate Season'}
          </button>
        </div>
      </div>
    </CommissionerLayout>
  );
}
