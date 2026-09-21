import { Avatar } from '../conversations/Avatar';

export interface MessageBubbleProps {
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  isOwnMessage: boolean;
  isRead?: boolean;
}

/**
 * A single message bubble, styled differently for own vs. others' messages.
 * Own messages: accent-colored, right-aligned, radius 16px 4px 16px 16px
 * Others' messages: light background, left-aligned, radius 4px 16px 16px 16px
 */
export function MessageBubble({
  senderId,
  senderName,
  text,
  createdAt,
  isOwnMessage,
  isRead = false,
}: MessageBubbleProps) {
  const createdDate = new Date(createdAt);
  const timeStr = createdDate.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isOwnMessage) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <div
          style={{
            maxWidth: '62%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '4px',
          }}
        >
          <div
            style={{
              background: '#C1552C',
              color: '#FFFFFF',
              borderRadius: '16px 4px 16px 16px',
              padding: '11px 15px',
              fontSize: '14px',
              lineHeight: '1.5',
              wordBreak: 'break-word',
            }}
          >
            {text}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              paddingRight: '2px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#A39B92' }}>{timeStr}</span>
            {/* Double checkmark for read status */}
            <svg
              width="15"
              height="10"
              viewBox="0 0 18 10"
              fill="none"
              style={{ opacity: isRead ? 1 : 0.5 }}
            >
              <path
                d="M1 5L5 9L11 1"
                stroke={isRead ? '#4CAF50' : '#C1552C'}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 5L11 9L17 1"
                stroke={isRead ? '#4CAF50' : '#C1552C'}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Others' messages
  return (
    <div style={{ display: 'flex', gap: '10px', maxWidth: '62%' }}>
      <Avatar initials={senderName.slice(0, 2).toUpperCase()} id={senderId} size={30} />
      <div
        style={{
          background: '#F5F1EB',
          borderRadius: '4px 16px 16px 16px',
          padding: '11px 15px',
          fontSize: '14px',
          lineHeight: '1.5',
          color: '#1B1815',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  );
}
