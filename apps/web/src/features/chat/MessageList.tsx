import { useEffect, useRef, useState } from 'react';
import { useMessageHistory } from './useMessageHistory';
import type { Message, MessageHistoryResponse } from './useMessageHistory';
import { MessageBubble } from './MessageBubble';

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
 */
export function MessageList({
  conversationId,
  currentUserId,
  userMap,
}: MessageListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessageHistory(conversationId);
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
  const allMessages = (
    data?.pages.flatMap((page: MessageHistoryResponse) => page.messages) ?? []
  ).reverse();

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
        />
      ))}

      {/* Invisible anchor for auto-scroll to bottom */}
      <div ref={messagesEndRef} />
    </div>
  );
}
