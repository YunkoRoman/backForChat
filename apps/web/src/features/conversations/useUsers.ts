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
 */
export function useUsers() {
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
  });
}
