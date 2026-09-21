import { useState, useMemo } from 'react';
import { useUsers } from './useUsers';
import { useAddMemberToConversation } from './useConversations';
import { Avatar } from './Avatar';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  currentMemberIds: string[];
}

export function AddMemberModal({
  isOpen,
  onClose,
  conversationId,
  currentMemberIds,
}: AddMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: usersData } = useUsers();
  const addMember = useAddMemberToConversation();

  const users = useMemo(() => usersData?.users ?? [], [usersData]);

  // Filter out users who are already members
  const availableUsers = useMemo(
    () => users.filter((user) => !currentMemberIds.includes(user.id)),
    [users, currentMemberIds]
  );

  // Filter by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return availableUsers;
    const query = searchQuery.toLowerCase();
    return availableUsers.filter(
      (user) =>
        user.displayName.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );
  }, [availableUsers, searchQuery]);

  const handleSelectUser = (userId: string) => {
    addMember.mutate(
      { conversationId, userId },
      {
        onSuccess: () => {
          handleClose();
        },
      }
    );
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '400px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #EFEAE3',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1B1815', margin: 0 }}>
            Додати члена
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#7A736C',
            }}
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #EFEAE3' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#F3EFE9',
              borderRadius: '10px',
              padding: '9px 12px',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#A39B92" strokeWidth="2" />
              <path d="M21 21L16.65 16.65" stroke="#A39B92" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Пошук користувача..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                fontFamily: 'Manrope, sans-serif',
                color: '#1B1815',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* User list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {filteredUsers.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: '#7A736C',
                padding: '32px 0',
                fontSize: '14px',
              }}
            >
              {searchQuery
                ? 'Користувачі не знайдені'
                : 'Всі користувачі вже членами'}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                disabled={addMember.isPending}
                style={{
                  width: '100%',
                  display: 'flex',
                  gap: '12px',
                  padding: '12px 0',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  borderBottom: '1px solid #F3EFE9',
                  cursor: addMember.isPending ? 'not-allowed' : 'pointer',
                  opacity: addMember.isPending ? 0.6 : 1,
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) =>
                  !addMember.isPending && (e.currentTarget.style.background = '#F9F7F3')
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <Avatar initials={getInitials(user.displayName)} id={user.id} size={40} />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1B1815' }}>
                    {user.displayName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#A39B92', marginTop: '2px' }}>
                    {user.email}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
