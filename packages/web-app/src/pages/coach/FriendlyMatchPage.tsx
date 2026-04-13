import { useState, useEffect } from 'react';
import { useLeague } from '../../hooks/useLeague';
import { getLeagueCoaches } from '../../lib/db-queries';
import { useAuth } from '../../hooks/useAuth';
import CoachLayout from '../../components/layouts/CoachLayout';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorMessage from '../../components/common/ErrorMessage';

export default function FriendlyMatchPage() {
  const { user } = useAuth();
  const { league, isLoading: leagueLoading } = useLeague();
  const [coaches, setCoaches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoach, setSelectedCoach] = useState<string>('');

  useEffect(() => {
    async function fetchCoaches() {
      if (!league) return;

      try {
        const data = await getLeagueCoaches(league.id);
        // Filter out current user
        const otherCoaches = data?.filter((c: any) => c.user_id !== user?.userId) || [];
        setCoaches(otherCoaches);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch coaches');
      } finally {
        setIsLoading(false);
      }
    }

    if (league) {
      fetchCoaches();
    }
  }, [league, user]);

  if (leagueLoading || isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <CoachLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Run a Friendly Match</h1>
          <p className="text-gray-600 mt-2">
            Challenge another coach to a practice match. Stats won't count toward league standings!
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2">What's a Friendly?</h3>
          <p className="text-blue-800">
            A friendly match uses all league rules but doesn't affect your standings. After the game,
            all player stats and team changes are reset - it's like it never happened! Perfect for practice
            or just for fun.
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Select Your Opponent</h3>

          {coaches.length === 0 ? (
            <p className="text-gray-600">
              No other coaches available for a friendly match right now.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="opponent" className="block text-sm font-medium text-gray-700 mb-2">
                  Choose Coach
                </label>
                <select
                  id="opponent"
                  value={selectedCoach}
                  onChange={(e) => setSelectedCoach(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="">Select an opponent...</option>
                  {coaches.map((coach) => (
                    <option key={coach.user_id} value={coach.user_id}>
                      {coach.users?.display_name || coach.users?.discord_username || 'Unknown Coach'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  Friendly match scheduling coming soon! This feature will allow you to invite coaches
                  and track the match without affecting league stats.
                </p>
              </div>

              <button
                disabled
                className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
              >
                Send Friendly Match Invitation (Coming Soon)
              </button>
            </div>
          )}
        </div>
      </div>
    </CoachLayout>
  );
}
