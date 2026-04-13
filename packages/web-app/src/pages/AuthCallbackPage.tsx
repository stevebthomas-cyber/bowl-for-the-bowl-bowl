import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../config/supabase';
import { handleAuthCallback } from '../lib/auth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorMessage from '../components/common/ErrorMessage';

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If already authenticated, just redirect
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session);

      if (event === 'SIGNED_IN' && session) {
        try {
          // Sync the user with our database
          const authenticatedUser = await handleAuthCallback();

          // Store in context
          login(authenticatedUser);

          // Redirect to dashboard
          navigate('/dashboard');
        } catch (err) {
          console.error('Auth callback error:', err);
          setError('Failed to complete authentication. Please try again.');
        }
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        setError('Failed to sign in. Please try again.');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [login, navigate, isAuthenticated]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md">
          <ErrorMessage message={error} />
          <button
            onClick={() => navigate('/')}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner message="Completing sign-in..." />
    </div>
  );
}
