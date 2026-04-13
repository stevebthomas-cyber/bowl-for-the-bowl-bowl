import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLeague } from '../hooks/useLeague';

export default function DashboardPage() {
  const { user, isCommissioner, isCoach, logout } = useAuth();
  const { league } = useLeague();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect commissioners to season settings if league is in setup mode
  // BUT only if they're on the root dashboard page (not navigating to a specific page)
  useEffect(() => {
    if (isCommissioner && league?.season_status === 'setup' && location.pathname === '/') {
      navigate('/commissioner/settings');
    }
  }, [isCommissioner, league, navigate, location]);

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">BBLMS</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.displayName}</span>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Select Your View</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {isCommissioner && (
            <button
              onClick={() => navigate('/commissioner')}
              className="p-8 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="text-6xl mb-4">👑</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Commissioner</h3>
              <p className="text-gray-600">
                Manage league settings, view all teams, create schedules, and review reports.
              </p>
            </button>
          )}

          {isCoach && (
            <button
              onClick={() => navigate('/coach')}
              className="p-8 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="text-6xl mb-4">🏈</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Coach</h3>
              <p className="text-gray-600">
                Manage your team, view your roster, submit match reports, and run friendlies.
              </p>
            </button>
          )}

          {!isCommissioner && !isCoach && (
            <div className="col-span-2">
              <div className="p-8 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                <h3 className="text-xl font-bold text-gray-900 mb-2">No League Role</h3>
                <p className="text-lg text-gray-700 mb-4">
                  You don't have a role in this league yet.
                </p>
                <p className="text-gray-600">
                  Contact your league commissioner to be granted the Coach role, or use the Discord bot command <code className="bg-gray-100 px-2 py-1 rounded">/register-coach</code> to join as a coach.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
