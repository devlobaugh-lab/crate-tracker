import { useAuth } from '../../AuthContext.tsx';

function UnauthorizedAccess() {
  const { logout } = useAuth() as any;

  const handleSignOut = async () => {
    try {
      // Clear any cached authorization state before signing out
      localStorage.clear();

      // Sign out from Firebase Auth
      await logout();

      // Force a full page reload without cache to reset all state
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to sign out:', error);
      // Even if logout fails, still reload the page
      window.location.href = '/';
    }
  };

  return (
    <div className='min-h-screen bg-gray-900 flex items-center justify-center p-6'>
      <div className='max-w-md w-full'>
        {/* Header */}
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold text-white mb-2'>Crate Tracker</h1>
          <p className='text-gray-300'>Invite-only access to sync your crate data</p>
        </div>

        {/* Access Denied Card */}
        <div className='bg-gray-800 rounded-2xl shadow-lg p-8'>
          <div className='text-center mb-6'>
            <div className='w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg className='w-8 h-8 text-white' fill='currentColor' viewBox='0 0 24 24'>
                <path d='M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9ZM19 9H14V4H19V9Z' />
              </svg>
            </div>
            <h2 className='text-xl font-semibold text-white mb-2'>Access Restricted</h2>
            <p className='text-gray-300 text-sm mb-4'>
              This application requires an invitation to access.
            </p>
            <p className='text-gray-300 text-sm'>
              Your Gmail account is not authorized to use this app.
            </p>
          </div>

          {/* Info Card */}
          <div className='bg-gray-700 rounded-lg p-4 mb-6'>
            <h3 className='text-sm font-semibold text-white mb-2'>How to Get Access:</h3>
            <ul className='text-xs text-gray-300 space-y-1 text-left'>
              <li>• Ask an admin user to invite you</li>
              <li>• Only Gmail accounts can be invited</li>
              <li>• You will receive setup instructions via email</li>
            </ul>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className='w-full bg-gray-700 text-gray-300 py-3 px-6 rounded-lg font-semibold hover:bg-gray-600 transition-colors duration-200'
          >
            Sign Out
          </button>
        </div>

        {/* Footer */}
        <div className='mt-8 text-center'>
          <p className='text-xs text-gray-500'>
            This app is invite-only. Please contact an existing user for access.
          </p>
        </div>
      </div>
    </div>
  );
}

export default UnauthorizedAccess;
