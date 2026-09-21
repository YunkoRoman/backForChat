import { useState } from 'react';
import type { Conversation } from './useConversations';
import { Avatar } from './Avatar';
import { AddMemberModal } from './AddMemberModal';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export interface ConversationHeaderProps {
  conversation: Conversation | null;
  userMap: Record<string, string>;
  currentUserId: string;
}

export function ConversationHeader({
  conversation,
  userMap,
  currentUserId,
}: ConversationHeaderProps) {
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  if (!conversation) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 24px',
          borderBottom: '1px solid #EFEAE3',
          flexShrink: 0,
          minHeight: '68px',
        }}
      >
        <div style={{ color: '#7A736C', fontSize: '14px' }}>Оберіть розмову</div>
      </div>
    );
  }

  let displayName = '';
  let avatarId = '';
  let isOnline = false;

  if (conversation.type === '1:1') {
    const otherUserId = conversation.memberIds.find((id) => id !== currentUserId);
    displayName = otherUserId ? userMap[otherUserId] || 'Unknown' : 'Unknown';
    avatarId = otherUserId || '';
  } else {
    displayName = conversation.name || 'Group';
    avatarId = conversation.conversationId;
  }

  const initials = getInitials(displayName);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 24px',
          borderBottom: '1px solid #EFEAE3',
          flexShrink: 0,
        }}
      >
        <Avatar initials={initials} id={avatarId} size={40} presence={isOnline && conversation.type === '1:1'} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#1B1815' }}>{displayName}</div>
          {/* Presence isn't wired up yet (section 5) - isOnline is always false
              for now, so this simply doesn't render rather than lying about status. */}
          {conversation.type === '1:1' && isOnline && (
            <div style={{ fontSize: '12.5px', color: '#3F9142', fontWeight: 600 }}>
              у мережі
            </div>
          )}
        </div>

        {/* Add member button (group only) */}
        {conversation.type === 'group' && (
          <button
            onClick={() => setShowAddMemberModal(true)}
            aria-label="Додати члена"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F3EFE9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M5 12H19" stroke="#7A736C" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <button
          aria-label="Пошук у розмові"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F3EFE9')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#7A736C" strokeWidth="2" />
            <path d="M21 21L16.65 16.65" stroke="#7A736C" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          aria-label="Більше опцій"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            border: 'none',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F3EFE9')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="12" r="1.6" fill="#7A736C" />
            <circle cx="12" cy="12" r="1.6" fill="#7A736C" />
            <circle cx="19" cy="12" r="1.6" fill="#7A736C" />
          </svg>
        </button>
      </div>

      <AddMemberModal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        conversationId={conversation.conversationId}
        currentMemberIds={conversation.memberIds}
      />
    </>
  );
}
