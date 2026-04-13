import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Pages
import LandingPage from './pages/LandingPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import InitialSetupPage from './pages/InitialSetupPage';

// Commissioner Pages
import CommissionerDashboard from './pages/commissioner/CommissionerDashboard';
import AllTeamsPage from './pages/commissioner/AllTeamsPage';
import LeagueSettingsPage from './pages/commissioner/LeagueSettingsPage';
import SchedulePage from './pages/commissioner/SchedulePage';
import ScheduleWizardPage from './pages/commissioner/ScheduleWizardPage';
import ScheduleBuilderPage from './pages/commissioner/ScheduleBuilderPage';
import StandingsPage from './pages/commissioner/StandingsPage';
import ActivateSeasonPage from './pages/commissioner/ActivateSeasonPage';
import StartNewSeasonPage from './pages/commissioner/StartNewSeasonPage';

// Coach Pages
import CoachDashboard from './pages/coach/CoachDashboardPage';
import CreateTeamPage from './pages/coach/CreateTeamPage';
import MyTeamPage from './pages/coach/MyTeamPage';
import MyRosterPage from './pages/coach/MyRosterPage';
import MatchReportPage from './pages/coach/MatchReportPage';
import FriendlyMatchPage from './pages/coach/FriendlyMatchPage';
import SeasonReUpPage from './pages/coach/SeasonReUpPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/initial-setup"
            element={
              <ProtectedRoute>
                <InitialSetupPage />
              </ProtectedRoute>
            }
          />

          {/* Commissioner Routes */}
          <Route
            path="/commissioner"
            element={
              <ProtectedRoute requireCommissioner>
                <CommissionerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/teams"
            element={
              <ProtectedRoute requireCommissioner>
                <AllTeamsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/settings"
            element={
              <ProtectedRoute requireCommissioner>
                <LeagueSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/schedule"
            element={
              <ProtectedRoute requireCommissioner>
                <SchedulePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/schedule-wizard"
            element={
              <ProtectedRoute requireCommissioner>
                <ScheduleWizardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/schedule-builder"
            element={
              <ProtectedRoute requireCommissioner>
                <ScheduleBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/standings"
            element={
              <ProtectedRoute requireCommissioner>
                <StandingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/activate-season"
            element={
              <ProtectedRoute requireCommissioner>
                <ActivateSeasonPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/commissioner/new-season"
            element={
              <ProtectedRoute requireCommissioner>
                <StartNewSeasonPage />
              </ProtectedRoute>
            }
          />

          {/* Coach Routes */}
          <Route
            path="/coach"
            element={
              <ProtectedRoute requireCoach>
                <CoachDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/create-team"
            element={
              <ProtectedRoute requireCoach>
                <CreateTeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/team"
            element={
              <ProtectedRoute requireCoach>
                <MyTeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/roster"
            element={
              <ProtectedRoute requireCoach>
                <MyRosterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/match-report"
            element={
              <ProtectedRoute requireCoach>
                <MatchReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/friendly"
            element={
              <ProtectedRoute requireCoach>
                <FriendlyMatchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/season-reup"
            element={
              <ProtectedRoute requireCoach>
                <SeasonReUpPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
