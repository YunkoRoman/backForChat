import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { fetchJson, setAccessToken } from '../../api/client';

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoreAttemptedRef = useRef(false);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await fetchJson<{ accessToken: string; user: User }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );
      setAccessToken(data.accessToken);
      setUser(data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setError(null);
      setIsLoading(true);
      try {
        const data = await fetchJson<{ accessToken: string; user: User }>(
          '/auth/register',
          {
            method: 'POST',
            body: JSON.stringify({ email, password, displayName }),
          }
        );
        setAccessToken(data.accessToken);
        setUser(data.user);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setError(null);
    try {
      // Call logout endpoint to clear the refresh token cookie
      await fetchJson<{ message: string }>('/auth/logout', {
        method: 'POST',
      });
    } catch (err) {
      console.error('Logout API call failed:', err);
    } finally {
      // Clear session regardless of API call success/failure
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  /**
   * Restore session on app load by calling the refresh endpoint
   * On success: set access token and clear session
   * On failure: clear session and show login page
   *
   * This is called once on app mount to handle page reloads
   */
  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Call refresh endpoint - it reads the refresh token from the httpOnly cookie
      const data = await fetchJson<{ accessToken: string }>(
        '/auth/refresh',
        { method: 'POST' }
      );
      setAccessToken(data.accessToken);

      // /auth/refresh returns only a new access token, not the user - fetch
      // the profile separately so a restored session actually counts as
      // signed in (consumers check `user`, not the token, for that).
      const me = await fetchJson<User>('/users/me');
      setUser(me);
    } catch (err) {
      // Session is expired or invalid - user will see login page
      setAccessToken(null);
      setUser(null);
      if (err instanceof Error && err.message !== 'SESSION_EXPIRED') {
        console.debug('Session restore failed:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restore session on app mount
  useEffect(() => {
    if (!restoreAttemptedRef.current) {
      restoreAttemptedRef.current = true;
      restoreSession();
    }
  }, [restoreSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        register,
        logout,
        restoreSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
