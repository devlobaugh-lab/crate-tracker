import { useState, useEffect, useRef } from 'react';
import logger from '../utils/logger';

// Define the state interface
interface AppState {
  series: { allCrates: string[] }[];
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

interface UseAppStateOptions {
  currentUser: User | null;
  userData: AppState | null;
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'pending' | 'error';
  saveUserData: (data: AppState) => Promise<boolean>;
  saveOfflineData: (data: AppState) => void;
  loadOfflineData: () => AppState | null;
  clearOfflineData: () => void;
  ignoreRemoteChanges: boolean;
}

interface UseAppStateReturn {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  isInitialized: boolean;
}

const DEFAULT_STATE: AppState = {
  series: Array.from({ length: 12 }, () => ({ allCrates: [] })),
  config: { wins: 0, gpWins: 0 },
};

/**
 * Application State Management Hook
 *
 * Business Logic Overview:
 * - Centralizes all application state management with offline/online synchronization
 * - Implements intelligent state initialization prioritizing localStorage over Firebase when offline
 * - Handles real-time Firebase updates with conflict prevention
 * - Manages debounced saving to prevent excessive Firestore writes
 * - Provides offline persistence with automatic cleanup
 *
 * State Initialization Strategy:
 * 1. Check if offline (syncStatus === 'error') and user authenticated
 * 2. If offline: Load from localStorage first (faster, guaranteed available)
 * 3. If online: Use Firebase userData (authoritative source)
 * 4. Fallback: Default empty state for new users
 *
 * Synchronization Flow:
 * - Real-time listener updates state when Firebase changes (unless ignored)
 * - State changes trigger debounced save to Firestore (500ms delay)
 * - Offline state saved to localStorage immediately
 * - Online state clears localStorage after successful sync
 * - ignoreRemoteChanges prevents conflicts during bulk operations
 *
 * Edge Cases Handled:
 * - Offline startup: Prioritizes localStorage for immediate UI responsiveness
 * - Firebase load failure: Falls back to localStorage or defaults
 * - Network interruptions: Queues operations for retry
 * - Bulk operations: Temporarily ignores remote changes
 * - State conflicts: Firebase real-time updates take precedence when online
 *
 * Performance Optimizations:
 * - Debounced saves reduce Firestore write frequency
 * - localStorage used for instant offline access
 * - Minimal re-renders through strategic useEffect dependencies
 * - Automatic cleanup of offline data after sync
 *
 * @param options - Configuration options including user data, sync status, and persistence functions
 * @returns Object containing state, setter, and initialization status
 */
export function useAppState({
  currentUser,
  userData,
  isOnline,
  syncStatus,
  saveUserData,
  saveOfflineData,
  loadOfflineData,
  clearOfflineData,
  ignoreRemoteChanges,
}: UseAppStateOptions): UseAppStateReturn {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<AppState>(() => {
    logger.log('🚀 App state initializing - checking data sources');
    logger.log(
      '🚀 Current context state - isOnline:',
      isOnline,
      'syncStatus:',
      syncStatus,
      'currentUser:',
      currentUser?.uid?.substring(0, 8)
    );

    // Check if we're in offline mode and should prioritize localStorage
    if (!isOnline && syncStatus === 'error' && currentUser) {
      logger.log('🔄 App startup in offline mode - prioritizing localStorage');

      try {
        const offlineData = loadOfflineData();
        if (offlineData) {
          logger.log('✅ Found offline data:');
          logger.log('  - Wins:', offlineData.config.wins);
          logger.log('  - Series:', offlineData.series.length);
          logger.log('  - Full data:', offlineData);

          logger.log(
            '🔄 Initializing with offline data (wins:',
            offlineData.config.wins,
            ', series:',
            offlineData.series.length,
            ')'
          );
          setIsInitialized(true);
          return offlineData;
        } else {
          logger.log('ℹ️ No valid offline data found in localStorage');
        }
      } catch (error) {
        logger.error('❌ Failed to load offline data during initialization:', error);
        logger.error('❌ Error details:', (error as Error).message);
      }
    }

    // Use userData if available, otherwise use default empty state
    if (userData) {
      logger.log('🔄 Initializing with Firebase data (wins:', userData.config?.wins || 0, ')');
      setIsInitialized(true);
      return userData;
    }

    logger.log('🔄 Initializing with default empty state');
    setIsInitialized(true);
    return DEFAULT_STATE;
  });

  // Update state when userData changes (from real-time listener)
  useEffect(() => {
    // Only update state from Firebase if we're truly online and not in error state
    if (userData && isOnline && syncStatus === 'synced' && !ignoreRemoteChanges) {
      logger.log('📡 Updating state from Firebase real-time data');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(userData);
    } else if (ignoreRemoteChanges) {
      logger.log('📡 Ignoring Firebase real-time data - remote changes ignored');
    } else {
      logger.log('📡 Ignoring Firebase real-time data - not in online synced state');
    }
  }, [userData, isOnline, syncStatus, ignoreRemoteChanges]);

  // Save to localStorage when state changes and we're offline
  useEffect(() => {
    if (state && currentUser && !isOnline && syncStatus === 'error') {
      logger.log('💾 Saving offline state to localStorage');
      logger.log('💾 State data:', state);
      saveOfflineData(state);
    }
  }, [state, currentUser, isOnline, syncStatus, saveOfflineData]);

  // Clear localStorage when successfully synced
  useEffect(() => {
    if (isOnline && syncStatus === 'synced' && currentUser) {
      logger.log('🗑️ Clearing localStorage after successful sync');
      clearOfflineData();
    }
  }, [isOnline, syncStatus, currentUser, clearOfflineData]);

  // Load offline data on app startup if we're offline
  useEffect(() => {
    if (currentUser && !isOnline && syncStatus === 'error' && !isInitialized) {
      logger.log('🔄 App startup - attempting to load offline data');
      // Small delay to ensure localStorage functions are available
      setTimeout(() => {
        const offlineData = loadOfflineData();
        if (offlineData) {
          logger.log('✅ Setting offline data to state');
          setState(offlineData);
          setIsInitialized(true);
        } else {
          logger.log('ℹ️ No offline data found');
          setIsInitialized(true);
        }
      }, 100);
    }
  }, [currentUser, isOnline, syncStatus, loadOfflineData, isInitialized]);

  // Debounced save state to Firestore to prevent excessive calls
  useEffect(() => {
    // Don't save if we're offline due to quota errors
    if (state && currentUser && isOnline && syncStatus !== 'error') {
      logger.log('📤 State changed, scheduling save...');

      // Clear any existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout - this ensures saves happen even with rapid clicks
      const timeout = setTimeout(() => {
        logger.log('💾 Executing scheduled save');
        saveUserData(state);
        saveTimeoutRef.current = null;
      }, 500); // Debounce saves by 500ms

      saveTimeoutRef.current = timeout;
    } else if (!isOnline || syncStatus === 'error') {
      logger.log('⏸️ Skipping scheduled save due to offline/quota error state');
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state, saveUserData, currentUser, isOnline, syncStatus]);

  return {
    state,
    setState,
    isInitialized,
  };
}
