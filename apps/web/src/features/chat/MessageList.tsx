import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMessageHistory } from './useMessageHistory';
import type { Message, MessageHistoryResponse } from './useMessageHistory';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { useReadReceipts } from './useReadReceipts';
import { useSocket } from '../../api/SocketContext';

export interface MessageListProps {
  conversationId: string | null;
  currentUserId: string;
  userMap: Record<string, string>;
}

const SCROLL_THRESHOLD = 100; // pixels from top to trigger load more

/**
 * Displays a conversation's message history with scroll-to-top pagination.
 * Messages are newest at the bottom. When scrolling to the top, older messages are fetched and prepended.
 * Scroll position is preserved during pagination to avoid jarring jumps.
 * Also subscribes to message:new events to append realtime messages.
 */
export function MessageList({
  conversationId,
  currentUserId,
  userMap,
}: MessageListProps) {
  const queryClient = useQueryClient();
  const { on, off, emit } = useSocket();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessageHistory(conversationId);
  const { latestReadByUser } = useReadReceipts(conversationId, currentUserId);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Each page comes back newest-first, and `data.pages` itself is ordered
  // [most-recent-page, ..., oldest-page-fetched-so-far] (that's fetch order:
  // the first page is the newest batch, fetchNextPage appends progressively
  // older ones). Flattening in that order and reversing the whole result
  // undoes both inversions at once, giving oldest-at-top/newest-at-bottom -
  // flattening without reversing would render the newest batch first (top)
  // and each page internally backwards.
  const allMessages = useMemo(
    () =>
      (data?.pages.flatMap((page: MessageHistoryResponse) => page.messages) ?? []).reverse(),
    [data]
  );

  // Chronological position (oldest = 0) of every currently-loaded message,
  // used to answer "is this message at or before someone's latest read
  // position" - `message:read:update` only ever names the single message
  // that was marked read, but per the backend's lastReadMessageId design
  // that implies everything up to and including it is read too.
  const messageIndexById = useMemo(() => {
    const map = new Map<string, number>();
    allMessages.forEach((message, index) => map.set(message.messageId, index));
    return map;
  }, [allMessages]);

  const isMessageRead = (messageId: string, senderId: string): boolean => {
    if (senderId !== currentUserId) return false;
    const messageIndex = messageIndexById.get(messageId);
    if (messageIndex === undefined) return false;

    return Object.values(latestReadByUser).some((readMessageId) => {
      const readIndex = messageIndexById.get(readMessageId);
      return readIndex !== undefined && messageIndex <= readIndex;
    });
  };

  // Subscribe to message:new events and append to cache
  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const handleNewMessage = (data: unknown) => {
      const messageData = data as {
        messageId: string;
        conversationId: string;
        senderId: string;
        text: string;
        createdAt: string;
      };

      // Only handle messages for the current conversation
      if (messageData.conversationId !== conversationId) {
        return;
      }

      // Append the message to the cache's last page
      queryClient.setQueryData(
        ['messages', conversationId],
        (oldData: {
          pages: MessageHistoryResponse[];
          pageParams: unknown[];
        } | undefined) => {
          if (!oldData || !oldData.pages || oldData.pages.length === 0) {
            return oldData;
          }

          // pages[0] is the most-recently-fetched page (newest messages),
          // and within a page the backend orders newest-first - so a brand
          // new live message belongs at the very front of pages[0], not
          // appended to the end of the LAST page (that's the oldest page
          // once the person has scrolled up and loaded more history).
          const newPages = [...oldData.pages];
          const firstPage = newPages[0];

          newPages[0] = {
            ...firstPage,
            messages: [
              {
                messageId: messageData.messageId,
                senderId: messageData.senderId,
                text: messageData.text,
                createdAt: messageData.createdAt,
              },
              ...firstPage.messages,
            ],
          };

          return {
            pages: newPages,
            pageParams: oldData.pageParams,
          };
        }
      );
    };

    on<{
      messageId: string;
      conversationId: string;
      senderId: string;
      text: string;
      createdAt: string;
    }>(
      'message:new',
      handleNewMessage as (...args: unknown[]) => void
    );

    return () => {
      off('message:new', handleNewMessage as (...args: unknown[]) => void);
    };
  }, [conversationId, queryClient, on, off]);

  // Send read receipt when the latest loaded message changes for the active
  // conversation. Tracked per-conversation so switching conversations and
  // back re-sends rather than getting stuck on a stale "already sent" guard.
  const lastReadEmittedRef = useRef<{ conversationId: string; messageId: string } | null>(null);
  useEffect(() => {
    if (!conversationId || allMessages.length === 0) {
      return;
    }

    // Get the latest message id
    const latestMessage = allMessages[allMessages.length - 1];
    if (
      latestMessage &&
      (lastReadEmittedRef.current?.conversationId !== conversationId ||
        lastReadEmittedRef.current?.messageId !== latestMessage.messageId)
    ) {
      lastReadEmittedRef.current = { conversationId, messageId: latestMessage.messageId };
      emit('message:read', {
        conversationId,
        messageId: latestMessage.messageId,
      });
    }
  }, [conversationId, allMessages, emit]);

  // Auto-scroll to bottom when new data arrives (if user is already at bottom)
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allMessages.length, shouldAutoScroll]);

  // Handle scroll events: detect if we're at the top
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;

    const { scrollTop } = scrollContainerRef.current;
    const isNearTop = scrollTop < SCROLL_THRESHOLD;

    // Check if user is at the bottom of the scroll area
    const { scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setShouldAutoScroll(isAtBottom);

    // Load more if near top and there are more pages to load
    if (isNearTop && hasNextPage && !isFetchingNextPage) {
      // Measure scroll height before fetching
      const scrollHeightBefore = scrollContainerRef.current.scrollHeight;

      fetchNextPage().then(() => {
        // After DOM updates, adjust scroll position to preserve visual position
        // Wait a bit for DOM updates
        setTimeout(() => {
          if (scrollContainerRef.current) {
            const scrollHeightAfter = scrollContainerRef.current.scrollHeight;
            const heightDelta = scrollHeightAfter - scrollHeightBefore;
            // Adjust scroll position by the amount of new content added
            scrollContainerRef.current.scrollTop += heightDelta;
          }
        }, 0);
      });
    }
  };

  if (!conversationId) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: '#7A736C',
        }}
      >
        Loading messages...
      </div>
    );
  }

  return (
    <>
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '22px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {isFetchingNextPage && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '12px',
              color: '#A39B92',
              margin: '8px 0',
            }}
          >
            Loading older messages...
          </div>
        )}

        {allMessages.length === 0 && !isFetchingNextPage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              color: '#7A736C',
              fontSize: '14px',
            }}
          >
            No messages yet. Start the conversation!
          </div>
        )}

        {allMessages.map((message: Message) => (
          <MessageBubble
            key={message.messageId}
            senderId={message.senderId}
            senderName={userMap[message.senderId] || 'Unknown'}
            text={message.text}
            createdAt={message.createdAt}
            isOwnMessage={message.senderId === currentUserId}
            isRead={isMessageRead(message.messageId, message.senderId)}
          />
        ))}

        {/* Invisible anchor for auto-scroll to bottom */}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <TypingIndicator
        conversationId={conversationId}
        currentUserId={currentUserId}
        userMap={userMap}
      />
    </>
  );
}
