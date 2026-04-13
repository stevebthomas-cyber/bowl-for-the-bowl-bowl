import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';
import LoginButton from '../components/auth/LoginButton';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center px-4">
        <h1 className="text-6xl font-bold text-white mb-4">
          Blood Bowl League Manager
        </h1>
        <p className="text-xl text-green-100 mb-8">
          Manage your Blood Bowl league with ease. Track teams, matches, and standings.
        </p>
        <LoginButton />
      </div>
    </div>
  );
}
