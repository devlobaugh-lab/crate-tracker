import React from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  WifiIcon
} from '@heroicons/react/24/outline';

/**
 * ConnectionStatus component for displaying network and sync status
 * @param {Object} props
 * @param {boolean} props.isOnline - Whether the app is online
 * @param {string} props.syncStatus - Current sync status ('synced', 'syncing', 'pending', 'error')
 * @param {Array} props.actionQueue - Array of pending actions
 */
function ConnectionStatus({ isOnline, syncStatus, actionQueue }) {
  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
      case 'syncing':
        return <ClockIcon className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'pending':
        return <ClockIcon className="w-4 h-4 text-yellow-400" />;
      case 'error':
        return <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />;
      default:
        return <WifiIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (actionQueue.length > 0) return `${actionQueue.length} pending`;

    switch (syncStatus) {
      case 'synced':
        return 'Data Synced';
      case 'syncing':
        return 'Data Syncing...';
      case 'pending':
        return 'Sync Pending';
      case 'error':
        return 'Sync error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {getStatusIcon()}
      <span className={`font-medium ${
        !isOnline ? 'text-red-400' :
        syncStatus === 'error' ? 'text-red-400' :
        syncStatus === 'pending' ? 'text-yellow-400' :
        syncStatus === 'syncing' ? 'text-blue-400' :
        'text-green-400'
      }`}>
        {getStatusText()}
      </span>
    </div>
  );
}

export default ConnectionStatus;
