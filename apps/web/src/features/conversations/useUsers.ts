import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../api/client';

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

/**
 * Fetch the user directory (all users except the current user).
 * Fetches a single page with a reasonable default limit.
 *
 * `enabled` defaults to true but should be tied to a picker's open state
 * when the caller stays mounted while hidden (e.g. a modal that toggles
 * visibility instead of unmounting) - otherwise this only ever fetches
 * once for the lifetime of that component and never picks up users who
 * register after it first mounted.
 */
export function useUsers(enabled = true) {
  return useQuery<{
    users: User[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ['users'],
    queryFn: async () => {
      return fetchJson<{
        users: User[];
        total: number;
        limit: number;
        offset: number;
      }>('/users?limit=100&offset=0');
    },
    enabled,
  });
}
