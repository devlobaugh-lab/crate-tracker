import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../AuthContext';
import AuthorizationService from '../../utils/authorization';
import { AuthorizedUser, UserInvitation } from '../../types';

/**
 * AdminView component for user management and administration
 */
interface AdminViewProps {
  onBack: () => void;
}

function AdminView({ onBack }: AdminViewProps) {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<AuthorizedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Form states for adding new user
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'normal'>('normal');
  const [submitting, setSubmitting] = useState(false);

  // Email preview states
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);

  const showMessage = useCallback((type: 'error' | 'success', message: string) => {
    setError(type === 'error' ? message : '');
    setSuccess(type === 'success' ? message : '');
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);
  }, []);

  const loadUsers = useCallback(async () => {
    if (!currentUser?.email) return;

    setLoading(true);
    const result = await AuthorizationService.listAuthorizedUsers(currentUser.email);
    setLoading(false);

    if (result.success && result.users) {
      setUsers(result.users);
    } else {
      showMessage('error', result.message || 'Failed to load users');
    }
  }, [currentUser?.email, showMessage]);

  useEffect(() => {
    if (!currentUser?.email) return;

    const loadUsersEffect = async () => {
      setLoading(true);
      const result = await AuthorizationService.listAuthorizedUsers(currentUser.email);
      setLoading(false);

      if (result.success && result.users) {
        setUsers(result.users);
      } else {
        showMessage('error', result.message || 'Failed to load users');
      }
    };

    loadUsersEffect();
  }, [currentUser?.email, showMessage]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.email || !newUserEmail.trim()) return;

    setSubmitting(true);
    const invitation: UserInvitation = {
      email: newUserEmail.trim(),
      role: newUserRole,
      invitedBy: currentUser.email,
    };

    const result = await AuthorizationService.authorizeUser(invitation, currentUser.email);
    setSubmitting(false);

    if (result.success) {
      showMessage('success', result.message || 'User added successfully');
      setNewUserEmail('');
      setNewUserRole('normal');
      loadUsers(); // Refresh the list
    } else {
      showMessage('error', result.message || 'Failed to add user');
    }
  };

  const handleUpdateRole = async (email: string, newRole: 'admin' | 'normal') => {
    if (!currentUser?.email) return;

    // Safety check: prevent last admin from demoting themselves
    if (email === currentUser.email && newRole === 'normal') {
      const adminCount = users.filter(
        user => user.role === 'admin' && user.status === 'active'
      ).length;
      if (adminCount === 1) {
        showMessage(
          'error',
          'Cannot demote the last remaining admin. Please promote another user to admin first.'
        );
        return;
      }
    }

    const result = await AuthorizationService.updateUserRole(email, newRole, currentUser.email);
    if (result.success) {
      showMessage('success', result.message || 'Role updated successfully');
      loadUsers();
    } else {
      showMessage('error', result.message || 'Failed to update role');
    }
  };

  const handleToggleStatus = async (email: string, currentStatus: 'active' | 'inactive') => {
    if (!currentUser?.email) return;

    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    // Safety check: prevent last admin from deactivating themselves
    if (email === currentUser.email && newStatus === 'inactive') {
      const adminCount = users.filter(
        user => user.role === 'admin' && user.status === 'active'
      ).length;
      if (adminCount === 1) {
        showMessage(
          'error',
          'Cannot deactivate the last remaining admin. Please promote another user to admin first.'
        );
        return;
      }
    }

    const result = await AuthorizationService.toggleUserStatus(email, newStatus, currentUser.email);
    if (result.success) {
      showMessage(
        'success',
        result.message || `User ${newStatus === 'active' ? 'activated' : 'deactivated'}`
      );
      loadUsers();
    } else {
      showMessage('error', result.message || 'Failed to change user status');
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!currentUser?.email) return;

    if (!confirm(`Are you sure you want to delete ${email}? This action cannot be undone.`)) {
      return;
    }

    const result = await AuthorizationService.deleteUser(email, currentUser.email);
    if (result.success) {
      showMessage('success', result.message || 'User deleted successfully');
      loadUsers();
    } else {
      showMessage('error', result.message || 'Failed to delete user');
    }
  };

  const handlePreviewEmail = async () => {
    if (!currentUser?.email || !newUserEmail.trim()) return;

    setPreviewing(true);
    const invitation: UserInvitation = {
      email: newUserEmail.trim(),
      role: newUserRole,
      invitedBy: currentUser.email,
    };

    const result = await AuthorizationService.previewInvitation(invitation, currentUser.email);
    setPreviewing(false);

    if (result.success && result.emailContent) {
      setPreviewContent(result.emailContent);
      setShowPreview(true);
    } else {
      showMessage('error', result.message || 'Failed to preview email');
    }
  };

  const handleSendInvitation = async () => {
    if (!currentUser?.email || !newUserEmail.trim()) return;

    setSubmitting(true);
    const invitation: UserInvitation = {
      email: newUserEmail.trim(),
      role: newUserRole,
      invitedBy: currentUser.email,
    };

    const result = await AuthorizationService.authorizeUser(invitation, currentUser.email);
    setSubmitting(false);

    if (result.success) {
      showMessage('success', result.message || 'User authorized! Send the email manually.');
      setNewUserEmail('');
      setNewUserRole('normal');
      setShowPreview(false);

      // Display email content for manual sending
      setPreviewContent(result.emailContent);

      // Show a new modal with send options
      setShowPreview(true);

      loadUsers(); // Refresh the list
    } else {
      showMessage('error', result.message || 'Failed to authorize user');
    }
  };

  return (
    <div className='bg-gray-700 px-4 py-4 rounded-2xl shadow-lg lg:max-w-6xl lg:mx-auto'>
      <div className='flex items-center justify-between mb-6'>
        <h2 className='text-lg font-bold text-white tracking-wide'>User Administration</h2>
        <button
          className='text-xs underline text-gray-300 hover:text-blue-400 transition-colors duration-200'
          onClick={onBack}
        >
          Back
        </button>
      </div>

      {/* Messages */}
      {error && <div className='mb-4 p-2 bg-red-600 text-white rounded-lg text-sm'>{error}</div>}
      {success && (
        <div className='mb-4 p-2 bg-green-600 text-white rounded-lg text-sm'>{success}</div>
      )}

      {/* Add New User Form */}
      <div className='mb-6 p-3 bg-gray-600 rounded-lg'>
        <h3 className='text-base font-semibold text-white mb-3'>Add New User</h3>
        <form onSubmit={handleAddUser}>
          <div className='flex'>
            <div className='flex-1'>
              <label className='block text-sm text-gray-300 mb-2'>Gmail Address</label>
              <input
                type='email'
                value={newUserEmail}
                onChange={e => setNewUserEmail(e.target.value)}
                placeholder='user@gmail.com'
                className='w-full py-2 px-3 border rounded-lg bg-gray-700 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
                required
              />
            </div>
          </div>
          <div className='flex gap-4 mt-4 items-end'>
            <div className='flex-1'>
              <label className='block text-sm text-gray-300 mb-2 mr-2'>Role</label>
              <select
                value={newUserRole}
                onChange={e => setNewUserRole(e.target.value as 'admin' | 'normal')}
                className='w-full py-2 px-3 border rounded-lg bg-gray-700 text-white border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='normal'>Normal</option>
                <option value='admin'>Admin</option>
              </select>
            </div>
            <button
              type='button'
              disabled={!newUserEmail.trim() || previewing}
              onClick={handlePreviewEmail}
              className='py-2 px-3 rounded-lg bg-gray-500 text-white text-sm font-semibold hover:bg-gray-600 disabled:bg-gray-400 transition-colors duration-200'
            >
              {previewing ? 'Loading...' : 'Preview'}
            </button>
            <button
              type='button'
              disabled={!newUserEmail.trim() || submitting}
              onClick={handleSendInvitation}
              className='py-2 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-blue-400 transition-colors duration-200'
            >
              {submitting ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>

      {/* Users List */}
      <div className='bg-gray-600 rounded-lg overflow-hidden'>
        <div className='p-4 border-b border-gray-500'>
          <h3 className='text-lg font-semibold text-white'>Authorized Users ({users.length})</h3>
        </div>

        {loading ? (
          <div className='p-6 text-center text-gray-400'>Loading users...</div>
        ) : users.length === 0 ? (
          <div className='p-6 text-center text-gray-400'>No authorized users found</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className='hidden lg:block overflow-x-auto'>
              <table className='w-full'>
                <thead className='bg-gray-500'>
                  <tr>
                    <th className='px-4 py-3 text-left text-white font-semibold text-sm'>Email</th>
                    <th className='px-4 py-3 text-left text-white font-semibold text-sm'>Role</th>
                    <th className='px-4 py-3 text-left text-white font-semibold text-sm'>Status</th>
                    {/* <th className='px-4 py-3 text-left text-white font-semibold text-sm'>
                      Invited By
                    </th>
                    <th className='px-4 py-3 text-left text-white font-semibold text-sm'>
                      Created
                    </th> */}
                    <th className='px-4 py-3 text-left text-white font-semibold text-sm'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className='border-b border-gray-600 hover:bg-gray-650'>
                      <td className='px-4 py-3 text-gray-300 text-xs'>{user.email}</td>
                      <td className='px-4 py-3 text-gray-300 min-w-32'>
                        <select
                          value={user.role}
                          onChange={e =>
                            handleUpdateRole(user.email, e.target.value as 'admin' | 'normal')
                          }
                          className='w-full bg-gray-700 text-white border border-gray-500 rounded px-2 py-1 text-xs'
                        >
                          <option value='normal'>Normal</option>
                          <option value='admin'>Admin</option>
                        </select>
                      </td>
                      <td className='px-4 py-3 text-gray-300'>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.status === 'active'
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      {/* <td className='px-4 py-3 text-gray-300 text-xs'>{user.invitedBy}</td>
                      <td className='px-4 py-3 text-gray-300 text-xs'>
                        {formatTimestamp(user.createdAt)}
                      </td> */}
                      <td className='px-4 py-3'>
                        <div className='flex gap-2'>
                          <button
                            onClick={() => handleToggleStatus(user.email, user.status)}
                            className={`px-2 py-1 rounded text-xs font-semibold transition-colors duration-200 ${
                              user.status === 'active'
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {user.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.email)}
                            className='px-2 py-1 rounded text-xs font-semibold bg-gray-600 hover:bg-gray-700 text-white transition-colors duration-200'
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className='lg:hidden space-y-3 p-3'>
              {users.map(user => (
                <div key={user.id} className='bg-gray-700 rounded-lg p-4 border border-gray-600'>
                  <div className='flex flex-col space-y-3'>
                    {/* Email */}
                    <div>
                      <div className='text-xs text-gray-400 uppercase font-semibold mb-1'>
                        Email
                      </div>
                      <div className='text-gray-300 font-medium break-all'>{user.email}</div>
                    </div>

                    {/* Role and Status Row */}
                    <div className='flex items-center justify-between'>
                      <div>
                        <div className='text-xs text-gray-400 uppercase font-semibold mb-1'>
                          Role
                        </div>
                        <select
                          value={user.role}
                          onChange={e =>
                            handleUpdateRole(user.email, e.target.value as 'admin' | 'normal')
                          }
                          className='bg-gray-600 text-white border border-gray-500 rounded px-2 py-1 text-sm w-24'
                        >
                          <option value='normal'>Normal</option>
                          <option value='admin'>Admin</option>
                        </select>
                      </div>
                      <div>
                        <div className='text-xs text-gray-400 uppercase font-semibold mb-1'>
                          Status
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            user.status === 'active'
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {user.status}
                        </span>
                      </div>
                    </div>

                    {/* Invited By and Created */}
                    {/* <div className='grid grid-cols-2 gap-4'>
                      <div>
                        <div className='text-xs text-gray-400 uppercase font-semibold mb-1'>
                          Invited By
                        </div>
                        <div className='text-gray-300 text-sm break-all'>{user.invitedBy}</div>
                      </div>
                      <div>
                        <div className='text-xs text-gray-400 uppercase font-semibold mb-1'>
                          Created
                        </div>
                        <div className='text-gray-300 text-sm'>
                          {formatTimestamp(user.createdAt)}
                        </div>
                      </div>
                    </div> */}

                    {/* Actions */}
                    <div>
                      <div className='text-xs text-gray-400 uppercase font-semibold mb-2'>
                        Actions
                      </div>
                      <div className='flex gap-2 flex-wrap'>
                        <button
                          onClick={() => handleToggleStatus(user.email, user.status)}
                          className={`px-3 py-1 rounded text-xs font-semibold transition-colors duration-200 whitespace-nowrap ${
                            user.status === 'active'
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {user.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.email)}
                          className='px-3 py-1 rounded text-xs font-semibold bg-gray-600 hover:bg-gray-700 text-white transition-colors duration-200 whitespace-nowrap'
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Email Preview Modal */}
      {showPreview && previewContent && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-lg font-semibold text-white'>Email Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className='text-gray-400 hover:text-white text-2xl'
                >
                  ×
                </button>
              </div>

              <div className='mb-4'>
                <div className='text-sm text-gray-300 mb-2'>
                  <strong>To:</strong> {previewContent.to}
                </div>
                <div className='text-sm text-gray-300 mb-4'>
                  <strong>Subject:</strong> {previewContent.subject}
                </div>
              </div>

              <div className='bg-white p-4 rounded-lg mb-6'>
                <div
                  className='text-gray-800'
                  style={{ fontFamily: 'Arial, sans-serif' }}
                  dangerouslySetInnerHTML={{ __html: previewContent.html }}
                />
              </div>

              <div className='text-xs text-gray-500 mb-4'>
                User has been authorized! Send this email through your preferred SMTP service.
              </div>

              <div className='flex flex-wrap gap-2 justify-end mb-4'>
                <button
                  onClick={() => navigator.clipboard.writeText(previewContent.html)}
                  className='px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors'
                >
                  Copy HTML
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(previewContent.text)}
                  className='px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors'
                >
                  Copy Text
                </button>
                <button
                  onClick={() =>
                    window.open(
                      `mailto:${previewContent.to}?subject=${encodeURIComponent(previewContent.subject)}&body=${encodeURIComponent(previewContent.text)}`,
                      '_blank'
                    )
                  }
                  className='px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors'
                >
                  Open in Gmail
                </button>
              </div>

              <div className='text-xs text-gray-400 mb-4 p-3 bg-gray-700 rounded'>
                <strong>For automated SMTP:</strong> Copy the HTML/text content and send through
                your SMTP server (e.g., Gmail SMTP, SendGrid, etc.)
              </div>

              <div className='flex gap-3 justify-end'>
                <button
                  onClick={() => setShowPreview(false)}
                  className='px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors'
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className='mt-4 text-sm text-gray-400 text-center'>Total users: {users.length}</div>
    </div>
  );
}

export default AdminView;
