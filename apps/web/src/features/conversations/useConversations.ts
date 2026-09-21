import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '../../api/client';

export interface Conversation {
  conversationId: string;
  type: '1:1' | 'group';
  name: string | null;
  memberIds: string[];
  createdAt: string;
}

/**
 * Fetch the user's list of conversations.
 * Sorted by createdAt (most recent first) server-side, but we'll sort on the frontend
 * to ensure consistency.
 */
export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const data = await fetchJson<Conversation[]>('/conversations');
      // Sort by createdAt descending (most recent first)
      return data.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
  });
}

/**
 * Create a 1:1 conversation with another user.
 * The backend will return the same conversation if one already exists.
 */
export function useCreateOneToOneConversation() {
  const queryClient = useQueryClient();
  return useMutation<
    Conversation,
    Error,
    { memberId: string }
  >({
    mutationFn: async ({ memberId }) => {
      return fetchJson<Conversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify({
          type: '1:1',
          memberId,
        }),
      });
    },
    onSuccess: () => {
      // Invalidate the conversations list so it refetches
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/**
 * Create a group conversation.
 */
export function useCreateGroupConversation() {
  const queryClient = useQueryClient();
  return useMutation<
    Conversation,
    Error,
    { name: string; memberIds: string[] }
  >({
    mutationFn: async ({ name, memberIds }) => {
      return fetchJson<Conversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify({
          type: 'group',
          name,
          memberIds,
        }),
      });
    },
    onSuccess: () => {
      // Invalidate the conversations list so it refetches
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

/**
 * Add a member to a group conversation.
 */
export function useAddMemberToConversation() {
  const queryClient = useQueryClient();
  return useMutation<
    { conversationId: string; memberIds: string[] },
    Error,
    { conversationId: string; userId: string }
  >({
    mutationFn: async ({ conversationId, userId }) => {
      return fetchJson<{ conversationId: string; memberIds: string[] }>(
        `/conversations/${conversationId}/members`,
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        }
      );
    },
    onSuccess: () => {
      // Invalidate the conversations list so it refetches
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
