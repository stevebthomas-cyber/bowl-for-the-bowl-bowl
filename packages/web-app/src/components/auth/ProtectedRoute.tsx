import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  requireCommissioner?: boolean;
  requireCoach?: boolean;
}

export function ProtectedRoute({
  children,
  requireCommissioner,
  requireCoach
}: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, isCommissioner, isCoach } = useAuth();

  console.log('ProtectedRoute:', { isLoading, isAuthenticated, isCommissioner, isCoach });

  if (isLoading) {
    console.log('ProtectedRoute: Still loading auth...');
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireCommissioner && !isCommissioner) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireCoach && !isCoach) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
