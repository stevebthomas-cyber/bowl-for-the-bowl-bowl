import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeague } from '../../hooks/useLeague';
import { supabase } from '../../config/supabase';
import CommissionerLayout from '../../components/layouts/CommissionerLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function CommissionerDashboard() {
  const { league, isLoading, refreshLeague } = useLeague();
  const [activating, setActivating] = useState(false);

  const handleForceActivate = async () => {
    if (!league || !confirm('Force activate season? This bypasses all requirements.')) return;

    setActivating(true);
    try {
      const { error } = await supabase
        .from('leagues')
        .update({
          season_status: 'active',
          current_season_start: new Date().toISOString()
        })
        .eq('id', league.id);

      if (error) throw error;

      await refreshLeague();
      alert('Season force activated!');
    } catch (err) {
      console.error('Failed to force activate:', err);
      alert('Failed to activate season');
    } finally {
      setActivating(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <CommissionerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{league?.name || 'League'}</h1>
          <p className="text-gray-600">Season {league?.season_number} - {league?.season_status}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            to="/commissioner/teams"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-bold mb-2">All Teams</h3>
            <p className="text-gray-600">View and manage all league teams</p>
          </Link>

          <Link
            to="/commissioner/standings"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-bold mb-2">Standings</h3>
            <p className="text-gray-600">View league rankings and statistics</p>
          </Link>

          <Link
            to="/commissioner/schedule"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-bold mb-2">Schedule</h3>
            <p className="text-gray-600">Create and manage match schedule</p>
          </Link>

          <Link
            to="/commissioner/settings"
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-xl font-bold mb-2">League Settings</h3>
            <p className="text-gray-600">Configure rules and season settings</p>
          </Link>

          {league?.season_status === 'setup' ? (
            <>
              <Link
                to="/commissioner/activate-season"
                className="p-6 bg-green-50 border-2 border-green-500 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-bold mb-2 text-green-900">Activate Season</h3>
                <p className="text-green-700">Start Season {league?.season_number} and begin play</p>
              </Link>

              <button
                onClick={handleForceActivate}
                disabled={activating}
                className="p-6 bg-orange-50 border-2 border-orange-500 rounded-lg shadow hover:shadow-md transition-shadow text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <h3 className="text-xl font-bold mb-2 text-orange-900">
                  {activating ? 'Activating...' : 'Force Activate (DEV)'}
                </h3>
                <p className="text-orange-700">Skip requirements and activate immediately for testing</p>
              </button>
            </>
          ) : (
            <Link
              to="/commissioner/new-season"
              className="p-6 bg-red-50 border-2 border-red-500 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <h3 className="text-xl font-bold mb-2 text-red-900">Start New Season</h3>
              <p className="text-red-700">Archive current season and begin a new one</p>
            </Link>
          )}
        </div>
      </div>
    </CommissionerLayout>
  );
}
