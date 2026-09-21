import { useEffect, useState } from 'react';
import { useSocket } from '../../api/SocketContext';

export interface TypingIndicatorProps {
  conversationId: string | null;
  currentUserId: string;
  userMap: Record<string, string>;
}

/**
 * Displays typing indicators for users currently typing in the conversation.
 * Subscribes to typing:update events and shows which users are typing.
 */
export function TypingIndicator({
  conversationId,
  currentUserId,
  userMap,
}: TypingIndicatorProps) {
  const { on, off } = useSocket();
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const handleTypingUpdate = (data: unknown) => {
      const typingData = data as {
        conversationId: string;
        userId: string;
        isTyping: boolean;
      };

      // Only handle updates for the current conversation
      if (typingData.conversationId !== conversationId) {
        return;
      }

      // Exclude the current user (they can't be typing as someone else)
      if (typingData.userId === currentUserId) {
        return;
      }

      setTypingUsers((prev) => {
        const updated = new Set(prev);
        if (typingData.isTyping) {
          updated.add(typingData.userId);
        } else {
          updated.delete(typingData.userId);
        }
        return updated;
      });
    };

    on<{
      conversationId: string;
      userId: string;
      isTyping: boolean;
    }>(
      'typing:update',
      handleTypingUpdate as (...args: unknown[]) => void
    );

    return () => {
      off('typing:update', handleTypingUpdate as (...args: unknown[]) => void);
    };
  }, [conversationId, currentUserId, on, off]);

  if (typingUsers.size === 0) {
    return null;
  }

  // Get the display names of typing users
  const typingNames = Array.from(typingUsers).map(
    (userId) => userMap[userId] || 'Unknown'
  );

  const displayText =
    typingNames.length === 1
      ? `${typingNames[0]} друкує...`
      : typingNames.length === 2
        ? `${typingNames.join(' і ')} друкують...`
        : `${typingNames.slice(0, -1).join(', ')} і ${typingNames[typingNames.length - 1]} друкують...`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 28px 0',
        fontSize: '13px',
        color: '#A39B92',
        fontStyle: 'italic',
        minHeight: '20px',
      }}
    >
      <span>{displayText}</span>
      {/* Animated dots */}
      <span
        style={{
          display: 'flex',
          gap: '2px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      >
        <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#A39B92' }} />
        <span
          style={{
            width: '3px',
            height: '3px',
            borderRadius: '50%',
            background: '#A39B92',
            animation: 'pulse 1.5s ease-in-out 0.2s infinite',
          }}
        />
        <span
          style={{
            width: '3px',
            height: '3px',
            borderRadius: '50%',
            background: '#A39B92',
            animation: 'pulse 1.5s ease-in-out 0.4s infinite',
          }}
        />
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
