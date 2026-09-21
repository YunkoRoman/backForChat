import { useState, useMemo } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { useSocket } from '../api/SocketContext';
import { useNavigate } from 'react-router-dom';
import {
  Sidebar,
  useConversations,
  useUsers,
  NewConversationModal,
  ConversationHeader,
} from '../features/conversations';

export function ChatPage() {
  const { logout, user } = useAuth();
  const { setActiveConversation } = useSocket();
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

        {/* Message area - empty state for now (section 5) */}
        <div className="flex-grow flex items-center justify-center bg-bg overflow-y-auto">
          <div style={{ background: '#FFFFFF', padding: '32px', borderRadius: '8px', textAlign: 'center' }}>
            <p style={{ color: '#7A736C', fontSize: '14px' }}>
              {activeConversationId
                ? 'Повідомлення будуть з\'являтися тут'
                : 'Оберіть розмову, щоб розпочати'}
            </p>
          </div>
        </div>
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
