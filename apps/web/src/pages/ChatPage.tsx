import { useAuth } from '../features/auth/AuthContext';
import { useNavigate } from 'react-router-dom';

export function ChatPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header with logout button */}
      <div className="border-b border-border bg-surface px-6 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl text-text">Chat</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm transition-colors"
        >
          Вийти
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-surface p-8 rounded-lg text-center">
          <p className="text-text-secondary">Chat page placeholder - chat shell section coming soon</p>
        </div>
      </div>
    </div>
  );
}
