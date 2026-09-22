import { useState, useMemo } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { useUsers } from './useUsers';
import type { User } from './useUsers';
import { useCreateOneToOneConversation, useCreateGroupConversation } from './useConversations';
import { Avatar } from './Avatar';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

type TabType = 'direct' | 'group';

export interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

export function NewConversationModal({
  isOpen,
  onClose,
  onConversationCreated,
}: NewConversationModalProps) {
  const [tab, setTab] = useState<TabType>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const { data: usersData } = useUsers(isOpen);
  const users = useMemo(() => usersData?.users ?? [], [usersData]);

  const createOneToOne = useCreateOneToOneConversation();
  const createGroup = useCreateGroupConversation();

  const { register, watch } = useForm<{ groupName: string }>({
    defaultValues: { groupName: '' },
  });
  const groupName = watch('groupName');

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((user) =>
      user.displayName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const handleSelectUser = (userId: string) => {
    if (tab === 'direct') {
      // Direct: select one user and immediately create conversation
      createOneToOne.mutate(
        { memberId: userId },
        {
          onSuccess: (conv) => {
            onConversationCreated(conv.conversationId);
            handleClose();
          },
        }
      );
    } else {
      // Group: toggle user selection
      const newSelected = new Set(selectedUsers);
      if (newSelected.has(userId)) {
        newSelected.delete(userId);
      } else {
        newSelected.add(userId);
      }
      setSelectedUsers(newSelected);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    if (selectedUsers.size === 0) return;

    const memberIds = Array.from(selectedUsers);
    createGroup.mutate(
      { name: groupName, memberIds },
      {
        onSuccess: (conv) => {
          onConversationCreated(conv.conversationId);
          handleClose();
        },
      }
    );
  };

  const handleClose = () => {
    setTab('direct');
    setSearchQuery('');
    setSelectedUsers(new Set());
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
          maxWidth: '500px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
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
            Нова розмова
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

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #EFEAE3',
            padding: '0 24px',
          }}
        >
          <button
            onClick={() => {
              setTab('direct');
              setSelectedUsers(new Set());
              setSearchQuery('');
            }}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'none',
              border: 'none',
              fontSize: '14px',
              fontWeight: tab === 'direct' ? 700 : 500,
              color: tab === 'direct' ? '#1B1815' : '#7A736C',
              borderBottom: tab === 'direct' ? '2px solid #C1552C' : 'none',
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
          >
            Особиста
          </button>
          <button
            onClick={() => {
              setTab('group');
              setSearchQuery('');
            }}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'none',
              border: 'none',
              fontSize: '14px',
              fontWeight: tab === 'group' ? 700 : 500,
              color: tab === 'group' ? '#1B1815' : '#7A736C',
              borderBottom: tab === 'group' ? '2px solid #C1552C' : 'none',
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
          >
            Група
          </button>
        </div>

        {/* Content */}
        {tab === 'direct' && (
          <DirectConversationTab
            users={filteredUsers}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectUser={handleSelectUser}
            isLoading={createOneToOne.isPending}
          />
        )}

        {tab === 'group' && (
          <GroupConversationTab
            users={filteredUsers}
            selectedUsers={selectedUsers}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectUser={handleSelectUser}
            groupName={groupName}
            groupNameRegister={register('groupName')}
            onCreateGroup={handleCreateGroup}
            isLoading={createGroup.isPending}
            error={selectedUsers.size === 0 ? 'Виберіть хоча б одного члена' : ''}
          />
        )}
      </div>
    </div>
  );
}

interface DirectConversationTabProps {
  users: User[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectUser: (userId: string) => void;
  isLoading: boolean;
}

function DirectConversationTab({
  users,
  searchQuery,
  onSearchChange,
  onSelectUser,
  isLoading,
}: DirectConversationTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
            onChange={(e) => onSearchChange(e.target.value)}
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
        {users.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#7A736C',
              padding: '32px 0',
              fontSize: '14px',
            }}
          >
            {searchQuery ? 'Користувачі не знайдені' : 'Немає користувачів'}
          </div>
        ) : (
          users.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user.id)}
              disabled={isLoading}
              style={{
                width: '100%',
                display: 'flex',
                gap: '12px',
                padding: '12px 0',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid #F3EFE9',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => !isLoading && (e.currentTarget.style.background = '#F9F7F3')}
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
  );
}

interface GroupConversationTabProps {
  users: User[];
  selectedUsers: Set<string>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectUser: (userId: string) => void;
  groupName: string;
  groupNameRegister: UseFormRegisterReturn<'groupName'>;
  onCreateGroup: () => void;
  isLoading: boolean;
  error: string;
}

function GroupConversationTab({
  users,
  selectedUsers,
  searchQuery,
  onSearchChange,
  onSelectUser,
  groupName,
  groupNameRegister,
  onCreateGroup,
  isLoading,
  error,
}: GroupConversationTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Group name input */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #EFEAE3', flexShrink: 0 }}>
        <input
          {...groupNameRegister}
          type="text"
          placeholder="Назва групи..."
          style={{
            width: '100%',
            padding: '9px 12px',
            border: '1px solid #EFEAE3',
            borderRadius: '10px',
            fontSize: '14px',
            fontFamily: 'Manrope, sans-serif',
            color: '#1B1815',
            outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#C1552C')}
          onBlur={(e) => (e.currentTarget.style.borderColor = '#EFEAE3')}
        />
      </div>

      {/* Search */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #EFEAE3', flexShrink: 0 }}>
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
            onChange={(e) => onSearchChange(e.target.value)}
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

      {/* User list with checkboxes */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 24px' }}>
        {users.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#7A736C',
              padding: '32px 0',
              fontSize: '14px',
            }}
          >
            {searchQuery ? 'Користувачі не знайдені' : 'Немає користувачів'}
          </div>
        ) : (
          users.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user.id)}
              disabled={isLoading}
              style={{
                width: '100%',
                display: 'flex',
                gap: '12px',
                padding: '12px 0',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid #F3EFE9',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => !isLoading && (e.currentTarget.style.background = '#F9F7F3')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              {/* Checkbox */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: '2px solid #C1552C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: selectedUsers.has(user.id) ? '#C1552C' : 'transparent',
                  flexShrink: 0,
                }}
              >
                {selectedUsers.has(user.id) && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
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

      {/* Footer with error and create button */}
      <div
        style={{
          padding: '16px 24px',
          borderTop: '1px solid #EFEAE3',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {error && <div style={{ color: '#C1552C', fontSize: '13px' }}>{error}</div>}
        <button
          onClick={onCreateGroup}
          disabled={isLoading || selectedUsers.size === 0 || !groupName.trim()}
          style={{
            marginLeft: 'auto',
            padding: '9px 20px',
            background: selectedUsers.size === 0 || !groupName.trim() ? '#EAE5DE' : '#C1552C',
            color: selectedUsers.size === 0 || !groupName.trim() ? '#A39B92' : '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: selectedUsers.size === 0 || !groupName.trim() || isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 200ms ease',
            opacity: isLoading ? 0.7 : 1,
          }}
          onMouseEnter={(e) =>
            selectedUsers.size > 0 && groupName.trim() && !isLoading && (e.currentTarget.style.background = '#A8461F')
          }
          onMouseLeave={(e) =>
            selectedUsers.size > 0 && groupName.trim() && (e.currentTarget.style.background = '#C1552C')
          }
        >
          {isLoading ? 'Створення...' : 'Створити'}
        </button>
      </div>
    </div>
  );
}
