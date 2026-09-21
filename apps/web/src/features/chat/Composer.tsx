import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../api/SocketContext';

export interface ComposerProps {
  conversationId: string | null;
}

/**
 * Message composer: text input + send button.
 * On submit: emits 'message:send' via socket, clears input.
 * Disabled when input is empty/whitespace-only.
 * Shows error state on 'message:send:error' event.
 * Emits typing:start/typing:stop events during typing.
 */
export function Composer({ conversationId }: ComposerProps) {
  const { emit, on, off } = useSocket();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for error events from the socket
  useEffect(() => {
    const handleError = (data: unknown) => {
      const errorData = data as { message: string };
      setError(errorData.message);
      setIsSubmitting(false);
    };

    on<{ message: string }>('message:send:error', handleError as (...args: unknown[]) => void);

    return () => {
      off('message:send:error', handleError as (...args: unknown[]) => void);
    };
  }, [on, off]);

  // Clean up typing timeout on unmount or conversation change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);

    if (!conversationId) return;

    // If text becomes non-empty and we weren't typing, emit typing:start
    if (newText.trim() && !isTypingRef.current) {
      isTypingRef.current = true;
      emit('typing:start', { conversationId });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to emit typing:stop after 2 seconds of no activity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current && conversationId) {
        isTypingRef.current = false;
        emit('typing:stop', { conversationId });
      }
    }, 2000);
  };

  const handleBlur = () => {
    // Emit typing:stop on blur
    if (isTypingRef.current && conversationId) {
      isTypingRef.current = false;
      emit('typing:stop', { conversationId });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input is not empty/whitespace-only
    if (!text.trim()) {
      return;
    }

    if (!conversationId) {
      setError('No conversation selected');
      return;
    }

    // Clear typing state on submit
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emit('typing:stop', { conversationId });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    // Clear any previous errors
    setError(null);
    setIsSubmitting(true);

    // Emit message via socket
    emit('message:send', {
      conversationId,
      text: text.trim(),
    });

    // Clear input immediately (optimistic UX)
    setText('');
    setIsSubmitting(false);
  };

  if (!conversationId) {
    return null;
  }

  const isDisabled = !text.trim() || isSubmitting;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '8px 28px',
            background: '#FBE7DC',
            color: '#C1552C',
            fontSize: '12px',
            borderBottom: '1px solid #F0D5C4',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
              color: '#C1552C',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 28px 22px 28px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: '#F3EFE9',
            borderRadius: '24px',
            border: '1.5px solid transparent',
            padding: '4px 6px 4px 18px',
            transition: 'border-color 0.2s ease',
          }}
        >
          <input
            type="text"
            value={text}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Написати повідомлення..."
            aria-label="Повідомлення"
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '14px',
              fontFamily: "'Manrope', sans-serif",
              color: '#1B1815',
              padding: '9px 0',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isDisabled}
          aria-label="Надіслати"
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: 'none',
            background: isDisabled ? '#D4C5BA' : '#C1552C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: isDisabled ? 'default' : 'pointer',
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isDisabled) {
              (e.target as HTMLButtonElement).style.background = '#A8461F';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDisabled) {
              (e.target as HTMLButtonElement).style.background = '#C1552C';
            }
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            style={{ stroke: 'white', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }}
          >
            <path d="M4 12H20M20 12L14 6M20 12L14 18" />
          </svg>
        </button>
      </form>
    </div>
  );
}
