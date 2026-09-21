/**
 * HTTP client for the chat API with automatic token refresh on 401
 *
 * Access token is stored in a module-level variable (never localStorage/sessionStorage)
 * Refresh token is managed automatically via httpOnly cookies by the server
 *
 * Concurrent refresh calls are deduplicated via a shared in-flight promise
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Module-level state
let accessToken: string | null = null;
let refreshInProgress: Promise<void> | null = null;

/**
 * Set the current access token (called by AuthContext after login/refresh)
 */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

/**
 * Get the current access token (used by SocketContext for auth)
 */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Refresh the access token using the refresh token cookie
 * Returns true if refresh succeeded, false otherwise
 * On failure, the caller should clear the session
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { accessToken: string };
    setAccessToken(data.accessToken);
    return true;
  } catch (error) {
    console.error('Refresh token failed:', error);
    return false;
  }
}

/**
 * Main fetch wrapper with 401 interceptor and refresh retry
 *
 * On 401:
 * 1. If no refresh is in progress, call /auth/refresh exactly once
 * 2. If refresh succeeds, retry the original request
 * 3. If refresh fails, propagate "session expired" signal
 * 4. If refresh is already in progress, wait for it and retry
 */
export async function fetchApi(
  endpoint: string,
  options: RequestInit = {},
  skipRefresh = false
): Promise<Response> {
  // Ensure we always send credentials for httpOnly cookie
  const finalOptions: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
  };

  const url = `${API_BASE_URL}${endpoint}`;
  let response = await fetch(url, finalOptions);

  // Handle 401 (unauthorized)
  if (response.status === 401 && !skipRefresh) {
    // Deduplicate concurrent refresh attempts
    if (!refreshInProgress) {
      refreshInProgress = refreshAccessToken().then((success) => {
        refreshInProgress = null;
        if (!success) {
          throw new Error('SESSION_EXPIRED');
        }
      });
    }

    try {
      await refreshInProgress;
    } catch (error) {
      if ((error as Error).message === 'SESSION_EXPIRED') {
        // Signal to auth context that session is expired
        throw new Error('SESSION_EXPIRED');
      }
      throw error;
    }

    // Retry the original request with the new token
    const retryOptions: RequestInit = {
      ...finalOptions,
      headers: {
        ...finalOptions.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    };
    response = await fetchApi(endpoint, retryOptions, true);
  }

  return response;
}

/**
 * Convenience wrapper that parses JSON response
 */
export async function fetchJson<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetchApi(endpoint, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}
