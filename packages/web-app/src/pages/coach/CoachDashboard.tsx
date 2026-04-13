import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTeams } from '../../hooks/useTeam';
import { useLeague } from '../../hooks/useLeague';
import { useAuth } from '../../hooks/useAuth';
import CoachLayout from '../../components/layouts/CoachLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import TeamOverview from '../../components/coach/TeamOverview';

export default function CoachDashboard() {
  const navigate = useNavigate();
  const { teams, isLoading } = useTeams();
  const { league } = useLeague();
  const { isCommissioner } = useAuth();
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);

  console.log('[CoachDashboard] teams:', teams, 'isLoading:', isLoading);

  // If user has no team, redirect them to team creation
  useEffect(() => {
    if (!isLoading && (!teams || teams.length === 0)) {
      navigate('/coach/create-team', { state: { returnPath: '/coach' } });
    }
  }, [isLoading, teams, navigate]);

  if (isLoading) return <LoadingSpinner />;

  // This will only show briefly before the redirect happens
  if (!teams || teams.length === 0) {
    return <LoadingSpinner />;
  }

  const currentTeam = teams[selectedTeamIndex];

  return (
    <CoachLayout>
      <div className="space-y-6">
        {league?.season_status === 'pre-season' && (
          <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🔔</div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-yellow-900 mb-2">
                  New Season Starting!
                </h3>
                <p className="text-yellow-800 mb-4">
                  Season {league.season_number} is beginning. Please complete your re-up process to confirm your participation.
                </p>
                <Link
                  to="/coach/season-reup"
                  className="inline-block px-6 py-3 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Complete Re-Up Process
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Team Selector - show only if user has multiple teams */}
        {teams.length > 1 && (
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Team
            </label>
            <div className="flex gap-2">
              {teams.map((team, index) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamIndex(index)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    index === selectedTeamIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <TeamOverview team={currentTeam} />

        <div className="grid md:grid-cols-2 gap-6">
          <Link
            to="/coach/team"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-bold mb-2">Manage Team</h3>
            <p className="text-gray-600">Buy staff, fans, and rerolls</p>
          </Link>

          <Link
            to="/coach/roster"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-bold mb-2">My Roster</h3>
            <p className="text-gray-600">View and manage your players</p>
          </Link>

          <Link
            to="/coach/match-report"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-bold mb-2">Submit Match Report</h3>
            <p className="text-gray-600">Report game results and stats</p>
          </Link>

          <Link
            to="/coach/friendly"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-2 border-blue-200"
          >
            <h3 className="text-xl font-bold mb-2 text-blue-700">Run a Friendly</h3>
            <p className="text-gray-600">Challenge another coach to a practice match</p>
          </Link>
        </div>
      </div>
    </CoachLayout>
  );
}
