import { useState, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useConversations } from './useConversations';
import type { Conversation } from './useConversations';
import { Avatar } from './Avatar';

/**
 * Extract the initials from a name (first letter of each word, max 3 chars)
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export interface SidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onLogout: () => void;
  /** Map of user IDs to user display names (for showing other person's name in 1:1 convos) */
  userMap: Record<string, string>;
}

export function Sidebar({
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onLogout,
  userMap,
}: SidebarProps) {
  const { user } = useAuth();
  const { data: conversations = [] } = useConversations();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      // Build the display name for filtering
      let displayName = '';
      if (conv.type === '1:1') {
        // For 1:1, get the other person's name
        const otherUserId = conv.memberIds.find((id) => id !== user?.id);
        displayName = otherUserId ? userMap[otherUserId] || 'Unknown' : 'Unknown';
      } else {
        // For group, use the group name
        displayName = conv.name || '';
      }
      return displayName.toLowerCase().includes(query);
    });
  }, [conversations, searchQuery, user?.id, userMap]);

  if (!user) return null;

  return (
    <div className="w-80 flex-shrink-0 bg-sidebar border-r border-border-subtle flex flex-col">
      {/* Account row */}
      <div className="flex items-center gap-3 px-5 py-4 pb-3">
        <Avatar initials={getInitials(user.displayName)} id={user.id} size={38} presence />
        <div className="flex-grow min-w-0">
          <div className="text-sm font-bold text-text truncate">
            {user.displayName}
          </div>
          <div className="text-xs text-text-secondary flex items-center gap-1">
            <span style={{ width: '7px', height: '7px' }} className="rounded-full bg-online inline-block" />
            у мережі
          </div>
        </div>
        <button
          onClick={onNewConversation}
          aria-label="Нова розмова"
          style={{ width: '34px', height: '34px', borderRadius: '9px', background: '#FBE7DC' }}
          className="flex-shrink-0 flex items-center justify-center transition-colors hover:opacity-80"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="#C1552C" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={onLogout}
          aria-label="Вийти"
          style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'transparent' }}
          className="flex-shrink-0 flex items-center justify-center transition-colors"
          onMouseEnter={(e) => e.currentTarget.style.background = '#F3EFE9'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M17 16L21 12M21 12L17 8M21 12H9M13 16V17C13 18.6569 11.6569 20 10 20H6C4.34315 20 3 18.6569 3 17V7C3 5.34315 4.34315 4 6 4H10C11.6569 4 13 5.34315 13 7V8" stroke="#7A736C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-2 bg-input-bg rounded-2.5 px-3 py-2" style={{ borderRadius: '10px', padding: '9px 12px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="#A39B92" strokeWidth="2" />
            <path d="M21 21L16.65 16.65" stroke="#A39B92" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Пошук"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-grow border-none bg-transparent outline-none text-sm font-normal text-text placeholder-text-tertiary"
            style={{ fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-grow overflow-y-auto px-2">
        {filteredConversations.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-text-secondary">
            {searchQuery ? 'Розмови не знайдені' : 'Немає розмов'}
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.conversationId}
              conversation={conv}
              isActive={activeConversationId === conv.conversationId}
              onSelect={() => onSelectConversation(conv.conversationId)}
              userMap={userMap}
              currentUserId={user.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  userMap: Record<string, string>;
  currentUserId: string;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  userMap,
  currentUserId,
}: ConversationItemProps) {
  let displayName = '';
  let avatarId = '';

  if (conversation.type === '1:1') {
    const otherUserId = conversation.memberIds.find((id) => id !== currentUserId);
    displayName = otherUserId ? userMap[otherUserId] || 'Unknown' : 'Unknown';
    avatarId = otherUserId || '';
  } else {
    displayName = conversation.name || 'Group';
    avatarId = conversation.conversationId;
  }

  const initials = getInitials(displayName);
  const timestamp = new Date(conversation.createdAt);
  const now = new Date();
  const isToday = timestamp.toDateString() === now.toDateString();
  const isThisYear = timestamp.getFullYear() === now.getFullYear();

  let timeStr = '';
  if (isToday) {
    timeStr = timestamp.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  } else if (isThisYear) {
    timeStr = timestamp.toLocaleDateString('uk-UA', { month: 'short', day: 'numeric' });
  } else {
    timeStr = timestamp.toLocaleDateString('uk-UA', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex',
        gap: '11px',
        padding: '10px 8px',
        borderRadius: '12px',
        marginBottom: '2px',
        width: '100%',
        background: isActive ? '#F3ECE2' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 150ms ease',
      }}
      onMouseEnter={(e) => !isActive && (e.currentTarget.style.background = '#f6f1ea')}
      onMouseLeave={(e) => !isActive && (e.currentTarget.style.background = 'transparent')}
    >
      <Avatar initials={initials} id={avatarId} size={44} />
      <div className="flex-grow min-w-0 flex flex-col justify-center gap-0.5">
        <div className="flex justify-between items-baseline gap-2" style={{ gap: '8px' }}>
          <span className="text-sm font-bold text-text truncate" style={{ fontSize: '14px' }}>
            {displayName}
          </span>
          <span className="text-xs text-text-tertiary flex-shrink-0 whitespace-nowrap" style={{ fontSize: '11px' }}>
            {timeStr}
          </span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-xs text-text-secondary truncate" style={{ fontSize: '12.5px' }}>
            {conversation.type === 'group' && 'Group conversation'}
          </span>
        </div>
      </div>
    </button>
  );
}
