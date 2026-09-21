import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchJson } from '../../api/client';

export interface Message {
  messageId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface MessageHistoryResponse {
  messages: Message[];
  nextCursor: {
    before?: string;
    limit: number;
  } | null;
}

export interface MessageCursor {
  before?: string;
  limit: number;
}

/**
 * Fetch the message history for a conversation with cursor-based pagination.
 * Pages are fetched newest-first (most recent at the bottom).
 * Use `useInfiniteQuery` to handle pagination - calling `fetchNextPage()` prepends older messages.
 */
export function useMessageHistory(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam }: { pageParam?: MessageCursor }) => {
      // Disabled if no conversation is selected
      if (!conversationId) {
        return { messages: [], nextCursor: null };
      }

      const searchParams = new URLSearchParams();
      if (pageParam?.before) {
        searchParams.set('before', pageParam.before);
      }
      if (pageParam?.limit) {
        searchParams.set('limit', pageParam.limit.toString());
      }

      const response = await fetchJson<MessageHistoryResponse>(
        `/conversations/${conversationId}/messages?${searchParams.toString()}`
      );
      return response;
    },
    getNextPageParam: (lastPage: MessageHistoryResponse) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: !!conversationId,
  });
}
