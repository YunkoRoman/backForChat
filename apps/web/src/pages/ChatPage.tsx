import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../features/auth/AuthContext';
import { useSocket } from '../api/SocketContext';
import { useNavigate } from 'react-router-dom';
import {
  Sidebar,
  useConversations,
  useUsers,
  NewConversationModal,
  ConversationHeader,
  type Conversation,
} from '../features/conversations';
import { MessageList, Composer } from '../features/chat';

export function ChatPage() {
  const { logout, user } = useAuth();
  const { setActiveConversation, on, off } = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);

  const { data: conversations = [] } = useConversations();
  const { data: usersData } = useUsers();
  const users = useMemo(() => usersData?.users ?? [], [usersData]);

  // Build a map of user ID to display name for quick lookup
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((user) => {
      map[user.id] = user.displayName;
    });
    return map;
  }, [users]);

  // Get the currently active conversation
  const activeConversation = useMemo(
    () => conversations.find((c) => c.conversationId === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    // Notify the socket context so it can join the room
    setActiveConversation(conversationId);
  };

  // Subscribe to message:new at the app level for handling background conversation updates
  useEffect(() => {
    const handleNewMessage = (data: unknown) => {
      const messageData = data as {
        messageId: string;
        conversationId: string;
        senderId: string;
        text: string;
        createdAt: string;
      };

      // Only handle messages for conversations that are NOT active
      if (messageData.conversationId === activeConversationId) {
        return; // MessageList handles this
      }

      // Conversation not in the cached list yet - most likely we were just
      // added to it (a brand new 1:1 or group) and haven't fetched it.
      // Refetch the list from the server so it shows up, rather than
      // silently dropping the notification.
      const cachedConversations = queryClient.getQueryData<Conversation[]>(['conversations']);
      if (
        Array.isArray(cachedConversations) &&
        !cachedConversations.some((c) => c.conversationId === messageData.conversationId)
      ) {
        void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        return;
      }

      // For background conversations, update the conversation list to bump to top
      // We do this by re-sorting conversations based on the new message timestamp
      queryClient.setQueryData(
        ['conversations'],
        (oldData: Conversation[] | undefined) => {
          if (!Array.isArray(oldData)) {
            return oldData;
          }

          // Find the conversation that this message belongs to
          const conversationIndex = oldData.findIndex(
            (c) => c.conversationId === messageData.conversationId
          );

          if (conversationIndex === -1) {
            return oldData;
          }

          // Create a new array with the updated conversation moved to the top.
          // Build a new conversation object rather than mutating the cached
          // one in place - React Query (and React generally) assumes cache
          // entries are immutable; mutating them can leave stale references
          // wherever something captured the old object before this update.
          const updated = [...oldData];
          const [existing] = updated.splice(conversationIndex, 1);

          // Update the conversation's createdAt to the new message's timestamp
          // This is a workaround since the backend data gap prevents tracking "last activity"
          const movedConversation = { ...existing, createdAt: messageData.createdAt };

          // Put it at the top
          return [movedConversation, ...updated];
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
  }, [activeConversationId, queryClient, on, off]);

  const handleConversationCreated = (conversationId: string) => {
    // Select the newly created conversation
    handleSelectConversation(conversationId);
    setShowNewConversationModal(false);
  };

  const handleLogout = async () => {
    // Clear active conversation and close modal
    setActiveConversationId(null);
    setShowNewConversationModal(false);
    // Clear the socket's active conversation
    setActiveConversation(null);
    // Logout
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Sidebar */}
      <Sidebar
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={() => setShowNewConversationModal(true)}
        onLogout={handleLogout}
        userMap={userMap}
      />

      {/* Main panel */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Conversation header */}
        <ConversationHeader
          conversation={activeConversation}
          userMap={userMap}
          currentUserId={user.id}
        />

        {/* Message area and composer */}
        {!activeConversationId ? (
          <div className="flex-grow flex items-center justify-center bg-bg">
            <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ color: '#7A736C', fontSize: '14px' }}>
                Оберіть розмову, щоб розпочати
              </p>
            </div>
          </div>
        ) : (
          <>
            <MessageList
              conversationId={activeConversationId}
              currentUserId={user.id}
              userMap={userMap}
            />
            <Composer conversationId={activeConversationId} />
          </>
        )}
      </div>

      {/* New conversation modal */}
      <NewConversationModal
        isOpen={showNewConversationModal}
        onClose={() => setShowNewConversationModal(false)}
        onConversationCreated={handleConversationCreated}
      />
    </div>
  );
}
