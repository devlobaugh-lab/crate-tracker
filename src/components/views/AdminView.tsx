/**
 * AdminView component for user management and administration
 */
interface AdminViewProps {
  onBack: () => void;
}

function AdminView({ onBack }: AdminViewProps) {
  // - List all users
  // - Add new user
  // - Change user roles
  // - Deactivate users

  return (
    <div className='bg-gray-700 px-6 py-4 rounded-2xl shadow-lg'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-xl font-bold text-white tracking-wide'>User Administration</h2>
        <button
          className='text-sm underline text-gray-300 hover:text-blue-400 transition-colors duration-200'
          onClick={onBack}
        >
          Back
        </button>
      </div>

      <div className='text-gray-300 mb-4'>Admin View - Coming Soon</div>
    </div>
  );
}

export default AdminView;
