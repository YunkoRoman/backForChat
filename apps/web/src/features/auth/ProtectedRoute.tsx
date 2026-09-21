import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * ProtectedRoute: Guards routes that require authentication
 *
 * Behavior:
 * - While isLoading (session restore in flight): shows minimal loading state
 * - Once resolved: redirects to /login if no user, else renders children
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // While session restore is in progress, show a minimal loading state
  // This prevents a flash of the login page for a valid session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          <p className="text-text-secondary mt-4">Завантаження...</p>
        </div>
      </div>
    );
  }

  // If no user after session restore completes, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the protected content
  return <>{children}</>;
}
