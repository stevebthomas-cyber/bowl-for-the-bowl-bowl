import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface CommissionerLayoutProps {
  children: ReactNode;
}

export default function CommissionerLayout({ children }: CommissionerLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="text-xl font-bold text-gray-900">
                BBLMS
              </Link>
              <div className="flex gap-4">
                <Link to="/commissioner" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link to="/commissioner/teams" className="text-gray-600 hover:text-gray-900">
                  Teams
                </Link>
                <Link to="/commissioner/standings" className="text-gray-600 hover:text-gray-900">
                  Standings
                </Link>
                <Link to="/commissioner/schedule" className="text-gray-600 hover:text-gray-900">
                  Schedule
                </Link>
                <Link to="/commissioner/settings" className="text-gray-600 hover:text-gray-900">
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">👑 {user?.displayName}</span>
              <button
                onClick={logout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
