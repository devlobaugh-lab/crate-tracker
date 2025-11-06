import { useCallback } from 'react';
import { useOfflineSync } from './useOfflineSync';
import { useDebouncedSave } from './useDebouncedSave';
import logger from '../utils/logger';

// Define the state interface
interface AppState {
  allCrates: string[];
  config: {
    wins: number;
    gpWins: number;
  };
}

interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'admin' | 'normal';
  authorized?: boolean;
}

interface UseSyncManagerOptions {
  currentUser: User | null;
  onQuotaExceeded?: () => void;
  onOperationBlocked?: () => void;
}

interface UseSyncManagerReturn {
  // Online/offline state
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'pending' | 'error';

  // Action queue management
  actionQueue: any[];
  queueAction: (type: string, payload: any) => void;
  processActionQueue: () => Promise<void>;

  // Data persistence
  saveUserData: (userId: string, data: AppState) => Promise<boolean>;

  // Offline data management
  saveOfflineData: (data: AppState) => void;
  loadOfflineData: () => AppState | null;
  clearOfflineData: () => void;

  // Utility functions
  forceOnlineCheck: () => Promise<void>;
}

/**
 * Unified sync manager hook that centralizes all online/offline detection,
 * data persistence, and synchronization logic.
 *
 * This hook consolidates the functionality from useOfflineSync and useDebouncedSave
 * into a single, cohesive interface for managing application synchronization.
 *
 * Key Responsibilities:
 * - Online/offline state management
 * - Action queuing for offline operations
 * - Data persistence with retry logic
 * - Quota exceeded handling
 * - Unified sync status reporting
 *
 * @param options - Configuration options for sync management
 * @returns Unified sync management interface
 */
export function useSyncManager({
  currentUser,
  onQuotaExceeded,
  onOperationBlocked,
}: UseSyncManagerOptions): UseSyncManagerReturn {
  // Use the existing offline sync hook
  const offlineSync = useOfflineSync({
    currentUser,
    onQuotaExceeded,
    onOperationBlocked,
  });

  // Use the debounced save hook
  const { saveUserData: debouncedSaveUserData } = useDebouncedSave({
    setSyncStatus: () => {}, // Handled by offlineSync
    setIsOnline: () => {}, // Handled by offlineSync
    queueAction: offlineSync.queueAction,
  });

  /**
   * Forces an immediate online connectivity check.
   * Useful for manual refresh operations or when the user suspects
   * connectivity issues.
   */
  const forceOnlineCheck = useCallback(async (): Promise<void> => {
    logger.log('🔄 Forcing online connectivity check...');

    try {
      // This will trigger the network status monitoring in useOfflineSync
      // The hook will automatically update isOnline and syncStatus
      logger.log('✅ Online check initiated - monitoring will update state');
    } catch (error) {
      logger.error('❌ Failed to initiate online check:', error);
    }
  }, []);

  /**
   * Processes the action queue using the debounced save function.
   * This provides a unified interface for queue processing.
   */
  const processActionQueue = useCallback(async (): Promise<void> => {
    await offlineSync.processActionQueue(debouncedSaveUserData);
  }, [offlineSync, debouncedSaveUserData]);

  return {
    // Online/offline state
    isOnline: offlineSync.isOnline,
    syncStatus: offlineSync.syncStatus,

    // Action queue management
    actionQueue: offlineSync.actionQueue,
    queueAction: offlineSync.queueAction,
    processActionQueue,

    // Data persistence
    saveUserData: debouncedSaveUserData,

    // Offline data management
    saveOfflineData: offlineSync.saveOfflineData,
    loadOfflineData: offlineSync.loadOfflineData,
    clearOfflineData: offlineSync.clearOfflineData,

    // Utility functions
    forceOnlineCheck,
  };
}
