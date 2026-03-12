import { useState, useEffect, useCallback } from 'react';
import { checkNetworkStatus } from '../firebase';
import { migrateToMultiSeries } from '../utils/validation';
import logger from '../utils/logger';

// Define the state interface
interface AppState {
  series: { allCrates: string[] }[];
  config: {
    wins: number;
    gpWins: number;
  };
}

// Action queue interface
interface QueuedAction {
  id: number;
  type: string;
  payload: any;
  timestamp: string;
}

interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'admin' | 'normal';
  authorized?: boolean;
}

interface UseOfflineSyncOptions {
  currentUser: User | null;
  onQuotaExceeded?: () => void;
  onOperationBlocked?: () => void;
}

interface UseOfflineSyncReturn {
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'pending' | 'error';
  actionQueue: QueuedAction[];
  queueAction: (type: string, payload: any) => void;
  processActionQueue: (
    saveUserDataFn: (userId: string, data: AppState) => Promise<boolean>
  ) => Promise<void>;
  saveOfflineData: (data: AppState) => void;
  loadOfflineData: () => AppState | null;
  clearOfflineData: () => void;
}

/**
 * Custom hook for managing offline synchronization, action queuing, and network status.
 * Handles Firebase quota exceeded scenarios, network connectivity monitoring, and
 * automatic retry logic when connectivity is restored.
 *
 * @param options - Configuration options including current user and callback handlers
 * @returns Object containing offline sync state and management functions
 */
export function useOfflineSync({
  currentUser,
  onQuotaExceeded,
  onOperationBlocked,
}: UseOfflineSyncOptions): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'pending' | 'error'>(
    'synced'
  );
  const [actionQueue, setActionQueue] = useState<QueuedAction[]>([]);

  /**
   * Queues an action for later processing when back online.
   * Used when Firebase operations fail due to network issues or quota limits.
   *
   * @param type - Action type identifier (e.g., 'save', 'update')
   * @param payload - Action data payload
   */
  const queueAction = useCallback((type: string, payload: any): void => {
    const action: QueuedAction = {
      id: Date.now() + Math.random(),
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    setActionQueue(prev => [...prev, action]);
    logger.log('Action queued:', action);
  }, []);

  /**
   * Processes all queued actions when connectivity is restored.
   * Attempts to execute each action and removes successful ones from the queue.
   * Failed actions are re-queued for later retry.
   *
   * @param saveUserDataFn - Function to save user data (injected to avoid circular dependencies)
   */
  const processActionQueue = useCallback(
    async (saveUserDataFn: (userId: string, data: AppState) => Promise<boolean>): Promise<void> => {
      if (actionQueue.length === 0) return;

      setSyncStatus('syncing');
      const actionsToProcess = [...actionQueue];
      setActionQueue([]);

      for (const action of actionsToProcess) {
        try {
          switch (action.type) {
            case 'save': {
              const success = await saveUserDataFn(action.payload.userId, action.payload.data);
              if (!success) {
                logger.error('Failed to process queued save action');
                // Re-queue if it fails
                setActionQueue(prev => [...prev, action]);
              }
              break;
            }
            default: {
              logger.warn('Unknown action type:', action.type);
            }
          }
        } catch (error) {
          logger.error('Failed to process queued action:', error);
          // Re-queue if it fails
          setActionQueue(prev => [...prev, action]);
        }
      }

      // Only set to synced if no actions were re-queued
      setTimeout(() => {
        if (actionQueue.length === 0) {
          setSyncStatus('synced');
        }
      }, 100);
    },
    [actionQueue]
  );

  /**
   * Saves current application state to localStorage for offline persistence.
   * Includes action queue state to maintain pending operations across sessions.
   *
   * @param data - Application state to persist
   */
  const saveOfflineData = useCallback(
    (data: AppState): void => {
      if (currentUser) {
        try {
          const offlineData = {
            data,
            queuedActions: actionQueue,
            timestamp: new Date().toISOString(),
            userId: currentUser.uid,
          };

          const dataString = JSON.stringify(offlineData);
          localStorage.setItem(`crate-tracker-offline-${currentUser.uid}`, dataString);

          // Verify it was saved
          const saved = localStorage.getItem(`crate-tracker-offline-${currentUser.uid}`);
          if (saved === dataString) {
            logger.log('💾 Successfully saved offline data to localStorage');
            logger.log('💾 Data preview:', {
              wins: data.config.wins,
              totalSeries: data.series.length,
            });
          } else {
            logger.error('❌ Failed to save offline data to localStorage');
          }
        } catch (error) {
          logger.error('❌ Error saving to localStorage:', error);
        }
      }
    },
    [currentUser, actionQueue]
  );

  /**
   * Loads previously saved offline data from localStorage.
   * Runs data through migrateToMultiSeries to handle legacy formats.
   * Returns null if no data exists or parsing fails.
   *
   * @returns Restored application state or null
   */
  const loadOfflineData = useCallback((): AppState | null => {
    if (currentUser) {
      const key = `crate-tracker-offline-${currentUser.uid}`;
      logger.log('🔍 Looking for localStorage key:', key);

      const savedData = localStorage.getItem(key);
      logger.log('📦 Raw localStorage data:', savedData);

      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          const { data, queuedActions, timestamp } = parsedData;

          logger.log('📤 Loaded offline data from localStorage:');
          logger.log('  - Timestamp:', timestamp);
          logger.log('  - Wins:', data.config.wins);
          logger.log('  - Series:', data.series?.length ?? 0);
          logger.log('  - Queued actions:', queuedActions.length);

          // Restore action queue if it exists
          if (queuedActions && Array.isArray(queuedActions)) {
            setActionQueue(queuedActions);
          }

          // Migrate legacy format if needed
          const { data: migratedData } = migrateToMultiSeries(data);

          // Don't automatically set state - return the data for App.jsx to handle
          logger.log('✅ Retrieved offline data from localStorage');
          return migratedData;
        } catch (error) {
          logger.error('❌ Failed to parse localStorage data:', error);
          logger.error('❌ Raw data that failed to parse:', savedData);
          return null;
        }
      } else {
        logger.log('ℹ️ No localStorage data found for key:', key);
      }
    }
    return null;
  }, [currentUser]);

  /**
   * Clears offline data from localStorage after successful sync.
   */
  const clearOfflineData = useCallback((): void => {
    if (currentUser) {
      localStorage.removeItem(`crate-tracker-offline-${currentUser.uid}`);
      logger.log('🗑️ Cleared offline data from localStorage');
    }
  }, [currentUser]);

  // Check network status and process queue when coming back online
  useEffect(() => {
    // Only process queue if we're online AND not in error state
    if (isOnline && actionQueue.length > 0 && syncStatus !== 'error') {
      logger.log('🔄 Processing action queue - back online');
      // Note: processActionQueue will be called by the component using this hook
      // since it needs access to the saveUserData function
    } else if (syncStatus === 'error' && actionQueue.length > 0) {
      logger.log('⏸️ Skipping action queue processing due to error state');
    }
  }, [isOnline, actionQueue.length, syncStatus]);

  // Listen for global Firebase quota exceeded events
  useEffect(() => {
    const handleQuotaExceeded = (event: CustomEvent) => {
      logger.log('🚨 Received global quota exceeded event:', event.detail);
      logger.log(
        '🚨 Current state before offline switch - isOnline:',
        isOnline,
        'syncStatus:',
        syncStatus
      );

      // Force offline mode and disable network
      setIsOnline(false);
      setSyncStatus('error');

      // Call optional callback
      onQuotaExceeded?.();

      logger.log('🚨 Successfully switched to offline mode due to quota exceeded');
    };

    const handleOperationBlocked = (event: CustomEvent) => {
      logger.log('🚨 Received blocked operation event:', event.detail);
      logger.log('🚨 Firebase operation blocked by client - switching to offline mode');

      // Treat blocked operations as offline scenario
      setIsOnline(false);
      setSyncStatus('error');

      // Call optional callback
      onOperationBlocked?.();

      logger.log('🚨 Successfully switched to offline mode due to blocked operations');
    };

    logger.log('🔧 Setting up global Firebase event listeners');
    window.addEventListener('firebase-quota-exceeded', handleQuotaExceeded as EventListener);
    window.addEventListener('firebase-operation-blocked', handleOperationBlocked as EventListener);

    return () => {
      logger.log('🔧 Removing global Firebase event listeners');
      window.removeEventListener('firebase-quota-exceeded', handleQuotaExceeded as EventListener);
      window.removeEventListener(
        'firebase-operation-blocked',
        handleOperationBlocked as EventListener
      );
    };
  }, [isOnline, syncStatus, onQuotaExceeded, onOperationBlocked]);

  // Monitor network status by testing connectivity on errors
  useEffect(() => {
    const checkConnection = async () => {
      // Don't check connection if we're in quota error state
      if (syncStatus === 'error' && !isOnline) {
        logger.log('⏸️ Skipping connection check due to quota error state');
        return;
      }

      const wasOnline = isOnline;
      const networkAvailable = await checkNetworkStatus();

      if (networkAvailable !== wasOnline) {
        setIsOnline(networkAvailable);
        if (networkAvailable) {
          setSyncStatus('syncing');
          // Process any queued actions when we come back online
          // Note: This will be handled by the component using this hook
        } else {
          setSyncStatus('error');
        }
      }
    };

    // Only check connection when appropriate
    if ((syncStatus === 'error' || actionQueue.length > 0) && isOnline) {
      const timeoutId = setTimeout(checkConnection, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [syncStatus, actionQueue.length, isOnline]);

  /**
   * Firebase Quota Reset Detection System
   *
   * Business Logic:
   * - Monitors Firebase quota limits and automatically attempts recovery
   * - Runs hourly checks at 2 minutes past each hour (when quotas typically reset)
   * - Tests quota restoration by attempting minimal Firebase operations
   * - Automatically switches back to online mode when quota is restored
   *
   * Algorithm Flow:
   * 1. Only activates when in offline error state (!isOnline && syncStatus === 'error')
   * 2. Schedules next check for next hour at :02 (e.g., 1:02, 2:02, 3:02...)
   * 3. When check time arrives, attempts checkNetworkStatus() test operation
   * 4. If successful: Switches to online mode, loads offline data, processes queued actions
   * 5. If failed: Schedules next hourly check and continues offline
   *
   * Error Handling:
   * - Distinguishes between quota errors and other network issues
   * - Continues retry attempts until quota is actually restored
   * - Logs all operations for debugging and monitoring
   *
   * Performance Considerations:
   * - Minimal Firebase operations during checks (network status test only)
   * - Hourly intervals prevent excessive checking while remaining responsive
   * - Automatic cleanup of timeout when quota restored or component unmounts
   */
  useEffect(() => {
    // Only run quota reset checks when in offline quota error state
    if (syncStatus === 'error' && !isOnline) {
      logger.log('⏰ Setting up smart quota reset detection (hourly at :02)');

      const scheduleNextQuotaCheck = (): ReturnType<typeof setTimeout> => {
        const now = new Date();
        const nextHour = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours() + 1,
          2,
          0
        );
        const millisecondsUntilNextCheck = nextHour.getTime() - now.getTime();

        logger.log(
          `⏰ Next quota check scheduled for: ${nextHour.toLocaleTimeString()} (${Math.round(millisecondsUntilNextCheck / 60000)} minutes)`
        );

        return setTimeout(() => {
          performQuotaCheck();
        }, millisecondsUntilNextCheck);
      };

      const performQuotaCheck = async (): Promise<void> => {
        logger.log('🔄 Checking if Firebase quota has been restored...');

        try {
          // Try a minimal Firebase operation to test quota
          const networkAvailable = await checkNetworkStatus();

          if (networkAvailable) {
            logger.log('✅ Firebase quota appears to be restored!');
            setIsOnline(true);
            setSyncStatus('syncing');

            // Load any offline data from localStorage first
            const offlineData = loadOfflineData();
            if (offlineData) {
              // Note: State update will be handled by component using this hook
            }

            // Process any queued actions - will be handled by component
            // Note: processActionQueue will be called by the component using this hook

            logger.log('🔄 Quota restoration check completed');
          } else {
            logger.log('⏸️ Firebase quota still exceeded - scheduling next check');
            // Schedule next check (will be at next hour :02)
            scheduleNextQuotaCheck();
          }
        } catch (error) {
          // Check if it's still a quota error or a different error
          const errorCode = (error as any)?.code;
          const isStillQuotaError =
            errorCode === 'resource-exhausted' ||
            (error as Error).message?.includes('Quota exceeded');

          if (isStillQuotaError) {
            logger.log('⏸️ Quota still exceeded - scheduling next check');
            scheduleNextQuotaCheck();
          } else {
            logger.log('⚠️ Different error detected:', (error as Error).message);
            // Could be network issues, schedule next check anyway
            scheduleNextQuotaCheck();
          }
        }
      };

      // Schedule first check
      const firstCheckTimeout = scheduleNextQuotaCheck();

      return () => {
        logger.log('🛑 Clearing quota reset detection timeout');
        clearTimeout(firstCheckTimeout);
      };
    }
  }, [syncStatus, isOnline, loadOfflineData]);

  return {
    isOnline,
    syncStatus,
    actionQueue,
    queueAction,
    processActionQueue,
    saveOfflineData,
    loadOfflineData,
    clearOfflineData,
  };
}
