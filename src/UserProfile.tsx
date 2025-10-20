import React from 'react';
import { useAuth } from './AuthContext.tsx';

function UserProfile() {
  const { currentUser, logout, authLoading } = useAuth();

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="flex items-center gap-3 bg-gray-700 rounded-lg px-4 py-2">
      <div className="flex items-center gap-3">
        <img
          src={currentUser.photoURL}
          alt={currentUser.displayName}
          className="w-8 h-8 rounded-full"
        />
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-white">{currentUser.displayName}</p>
          <p className="text-xs text-gray-300">{currentUser.email}</p>
        </div>
      </div>

      <button
        onClick={handleLogout}
        disabled={authLoading}
        className="ml-auto px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Sign out"
      >
        {authLoading ? '...' : 'Sign out'}
      </button>
    </div>
  );
}

export default UserProfile;
