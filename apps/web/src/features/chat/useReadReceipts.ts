import { useEffect, useState } from 'react';
import { useSocket } from '../../api/SocketContext';

/**
 * Hook to track read receipts for a conversation.
 *
 * Tracks each OTHER user's latest read position as a single messageId
 * (matching the backend's `lastReadMessageId` semantics: "read up to and
 * including this message", not "read exactly this one message"). Callers
 * resolve whether a given message counts as read by comparing its position
 * in the conversation's message list against this latest-read messageId -
 * a message at or before someone's latest read position is implicitly read
 * too, even if no message:read:update ever named it individually.
 */
export function useReadReceipts(conversationId: string | null, currentUserId: string) {
  const { on, off } = useSocket();
  // userId -> the messageId they've read up to
  const [latestReadByUser, setLatestReadByUser] = useState<Record<string, string>>({});

  // Reset when switching conversations, so a stale read position from a
  // previous conversation can't leak into this one. Adjusting state during
  // render (React's documented pattern for "reset on prop change") instead
  // of a separate effect - avoids an extra render + effect round trip.
  const [trackedConversationId, setTrackedConversationId] = useState(conversationId);
  if (conversationId !== trackedConversationId) {
    setTrackedConversationId(conversationId);
    setLatestReadByUser({});
  }

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const handleReadUpdate = (data: unknown) => {
      const readData = data as {
        conversationId: string;
        userId: string;
        messageId: string;
      };

      if (readData.conversationId !== conversationId) {
        return;
      }
      // Only other members' read positions matter for showing "read" on
      // the current user's own messages.
      if (readData.userId === currentUserId) {
        return;
      }

      setLatestReadByUser((prev) => ({
        ...prev,
        [readData.userId]: readData.messageId,
      }));
    };

    on<{
      conversationId: string;
      userId: string;
      messageId: string;
    }>(
      'message:read:update',
      handleReadUpdate as (...args: unknown[]) => void
    );

    return () => {
      off('message:read:update', handleReadUpdate as (...args: unknown[]) => void);
    };
  }, [conversationId, currentUserId, on, off]);

  return { latestReadByUser };
}
