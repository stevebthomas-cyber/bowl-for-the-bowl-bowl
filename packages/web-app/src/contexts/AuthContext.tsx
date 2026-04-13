import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AuthenticatedUser } from '../types/auth';

interface AuthContextType {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isCommissioner: boolean;
  isCoach: boolean;
  hasTeam: boolean;
  login: (user: AuthenticatedUser) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'bblms_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newUser: AuthenticatedUser) => {
    setUser(newUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // Derived state
  const isAuthenticated = !!user;
  const isCommissioner = user?.roles.some(r => r.role === 'commissioner') || false;
  const isCoach = user?.roles.some(r => r.role === 'coach') || false;
  const hasTeam = !!(user?.teamIds && user.teamIds.length > 0);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        isCommissioner,
        isCoach,
        hasTeam,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
