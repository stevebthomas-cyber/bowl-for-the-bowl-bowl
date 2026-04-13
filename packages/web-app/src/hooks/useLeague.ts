import { useState, useEffect } from 'react';
import { getLeague } from '../lib/db-queries';

export function useLeague() {
  const [league, setLeague] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeague = async () => {
    try {
      const data = await getLeague();
      setLeague(data);
    } catch (err) {
      console.error('Failed to fetch league:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch league');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeague();
  }, []);

  const refreshLeague = async () => {
    try {
      const data = await getLeague();
      setLeague(data);
    } catch (err) {
      console.error('Failed to refresh league:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh league');
    }
  };

  return { league, isLoading, error, refreshLeague };
}
