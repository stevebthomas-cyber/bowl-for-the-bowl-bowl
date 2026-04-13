import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface CoachLayoutProps {
  children: ReactNode;
}

export default function CoachLayout({ children }: CoachLayoutProps) {
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
                <Link to="/coach" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link to="/coach/team" className="text-gray-600 hover:text-gray-900">
                  My Team
                </Link>
                <Link to="/coach/roster" className="text-gray-600 hover:text-gray-900">
                  My Roster
                </Link>
                <Link to="/coach/match-report" className="text-gray-600 hover:text-gray-900">
                  Match Report
                </Link>
                <Link to="/coach/friendly" className="text-gray-600 hover:text-blue-600">
                  Run a Friendly
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">🏈 {user?.displayName}</span>
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
