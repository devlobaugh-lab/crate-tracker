import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  // GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, FirestoreError } from 'firebase/firestore';
import { auth, db, googleProvider, checkNetworkStatus } from './firebase.ts';
import { User, AuthContextType } from './types';
import logger from './utils/logger';

// Define the state interface
interface AppState {
  allCrates: string[];
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

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<AppState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [ignoreRemoteChanges, setIgnoreRemoteChanges] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'pending' | 'error'>(
    'synced'
  );
  const [actionQueue, setActionQueue] = useState<QueuedAction[]>([]);

  // Google sign in
  async function signInWithGoogle(): Promise<FirebaseUser> {
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      logger.error('Error signing in with Google:', error);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  // Sign out
  async function logout(): Promise<void> {
    setAuthLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      logger.error('Error signing out:', error);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  // Load user data from Firestore
  async function loadUserData(userId: string): Promise<AppState> {
    logger.log('📥 Loading user data for:', userId?.substring(0, 8) + '...');

    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        logger.log('✅ User data loaded successfully');
        return userDoc.data() as AppState;
      } else {
        logger.log('📝 Creating new user document');
        // Create default user data if it doesn't exist
        const defaultData: AppState = {
          allCrates: [],
          config: { wins: 0, gpWins: 0 },
        };
        try {
          await setDoc(userDocRef, defaultData);
          logger.log('✅ Default user data created');
        } catch (createError) {
          logger.error('❌ Error creating default user data:', createError);
          logger.error('❌ Create error code:', (createError as FirestoreError).code);
          logger.error('❌ Create error message:', (createError as FirestoreError).message);
          // Continue with default data even if save fails
        }
        return defaultData;
      }
    } catch (error) {
      logger.error('❌ Error loading user data:', error);
      logger.error('❌ Load error code:', (error as FirestoreError).code);
      logger.error('❌ Load error message:', (error as FirestoreError).message);

      // Only treat as offline for specific network/quota errors
      const errorCode = (error as any)?.code;
      const isNetworkError =
        errorCode === 'unavailable' ||
        errorCode === 'deadline-exceeded' ||
        errorCode === 'cancelled';

      const isQuotaError =
        errorCode === 'resource-exhausted' || (error as Error).message?.includes('Quota exceeded');

      if (isNetworkError || isQuotaError) {
        logger.log('🚫 Network/quota error detected - staying online but will retry');
        setSyncStatus('pending');
      }

      // Return default data if Firestore fails
      return { allCrates: [], config: { wins: 0, gpWins: 0 } };
    }
  }

  // Action queue for offline operations
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

  // Enhanced save user data with offline support and retry logic
  const saveUserData = useCallback(
    async (userId: string, data: AppState, retryCount = 0): Promise<boolean> => {
      const maxRetries = 3;
      const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff

      logger.log('🔄 saveUserData called with:', {
        userId: userId?.substring(0, 8) + '...',
        dataKeys: Object.keys(data),
        retryCount,
      });

      try {
        logger.log('💾 Saving user data to Firestore...');
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, data, { merge: true });
        setSyncStatus('synced');
        logger.log('✅ Firestore save successful');
        return true; // Success
      } catch (error) {
        logger.error('❌ Error saving user data to Firestore:', error);
        logger.error('❌ Error code:', (error as FirestoreError).code);
        logger.error('❌ Error message:', (error as FirestoreError).message);

        // Check if it's a network-related error (retry these)
        const errorCode = (error as any)?.code;
        const isNetworkError =
          errorCode === 'unavailable' ||
          errorCode === 'deadline-exceeded' ||
          errorCode === 'cancelled' ||
          (error as Error).message?.includes('network') ||
          (error as Error).message?.includes('offline');

        // Check if it's a quota/resource error (don't retry these)
        const isQuotaError =
          errorCode === 'resource-exhausted' ||
          (error as Error).message?.includes('Quota exceeded') ||
          (error as Error).message?.includes('quota') ||
          (error as Error).message?.includes('limit');

        if (isNetworkError && retryCount < maxRetries) {
          setSyncStatus('pending');
          logger.log(
            `Retrying save operation in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`
          );

          // Return a promise that resolves after the retry delay
          return new Promise(resolve => {
            setTimeout(async () => {
              try {
                const result = await saveUserData(userId, data, retryCount + 1);
                resolve(result);
              } catch (retryError) {
                logger.error('Retry failed:', retryError);
                resolve(false); // Failed after retry
              }
            }, retryDelay);
          });
        } else if (isQuotaError) {
          // For quota errors, immediately go offline without retrying
          setIsOnline(false);
          setSyncStatus('error');
          logger.error('Quota exceeded - switching to offline mode:', (error as Error).message);

          // Queue the action for later when quota is restored
          queueAction('save', { userId, data });
          return false; // Failed
        } else {
          // For other non-network errors or max retries reached, treat as offline
          setIsOnline(false);
          setSyncStatus('error');
          logger.error(
            'Save failed after retries or due to non-network error:',
            (error as Error).message
          );

          // Queue the action for later when quota is restored
          queueAction('save', { userId, data });
          return false; // Failed
        }
      }
    },
    [queueAction, setSyncStatus, setIsOnline]
  );

  // Process queued actions when back online
  const processActionQueue = useCallback(async (): Promise<void> => {
    if (actionQueue.length === 0) return;

    setSyncStatus('syncing');
    const actionsToProcess = [...actionQueue];
    setActionQueue([]);

    for (const action of actionsToProcess) {
      try {
        switch (action.type) {
          case 'save': {
            const success = await saveUserData(action.payload.userId, action.payload.data);
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
  }, [saveUserData, setSyncStatus, setActionQueue, actionQueue]);

  // localStorage persistence for offline data
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
              crates: data.allCrates.length,
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
          logger.log('  - Crates:', data.allCrates.length);
          logger.log('  - Queued actions:', queuedActions.length);

          // Don't automatically set state - return the data for App.jsx to handle
          logger.log('✅ Retrieved offline data from localStorage');
          return data;
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
      processActionQueue();
    } else if (syncStatus === 'error' && actionQueue.length > 0) {
      logger.log('⏸️ Skipping action queue processing due to error state');
    }
  }, [isOnline, actionQueue.length, syncStatus, processActionQueue]);

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

      // Also force disable Firestore network to prevent further operations
      import('./firebase').then(({ forceOfflineMode }) => {
        forceOfflineMode();
      });

      logger.log('🚨 Successfully switched to offline mode due to quota exceeded');
    };

    const handleOperationBlocked = (event: CustomEvent) => {
      logger.log('🚨 Received blocked operation event:', event.detail);
      logger.log('🚨 Firebase operation blocked by client - switching to offline mode');

      // Treat blocked operations as offline scenario
      setIsOnline(false);
      setSyncStatus('error');

      // Disable Firestore network to prevent further blocked requests
      import('./firebase').then(({ forceOfflineMode }) => {
        forceOfflineMode();
      });

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
  }, [isOnline, syncStatus]);

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      logger.log('🔐 Auth state changed:', user ? 'signed in' : 'signed out');

      if (user) {
        // User is signed in - reset connection state and load their data
        logger.log('🔐 User signed in, resetting connection state');
        setIsOnline(true);
        setSyncStatus('synced');
        setCurrentUser({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || undefined,
          photoURL: user.photoURL || undefined,
        });
        setLoading(true);

        try {
          const data = await loadUserData(user.uid);
          setUserData(data);
          logger.log('✅ User data loaded successfully after sign in');
        } catch (error) {
          logger.error('❌ Failed to load user data after sign in:', error);
          setUserData({ allCrates: [], config: { wins: 0, gpWins: 0 } });
        }
      } else {
        // User is signed out, clear data
        logger.log('🔐 User signed out, clearing data');
        setCurrentUser(null);
        setUserData(null);
        setIsOnline(true); // Reset to online state for next sign in
        setSyncStatus('synced');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Set up real-time listener for user data changes
  useEffect(() => {
    if (!currentUser) {
      logger.log('⏸️ No current user - skipping real-time listener setup');
      return;
    }

    // Always try to set up the listener when we have a current user
    logger.log(
      '🔄 Setting up real-time listener for user:',
      currentUser.uid.substring(0, 8) + '...'
    );
    const userDocRef = doc(db, 'users', currentUser.uid);

    const unsubscribe = onSnapshot(
      userDocRef,
      doc => {
        if (doc.exists() && !ignoreRemoteChanges) {
          logger.log('📡 Real-time data update received from Firebase');
          setUserData(doc.data() as AppState);
        }
      },
      error => {
        logger.error('❌ Real-time listener error:', error);
        logger.error('❌ Listener error code:', (error as FirestoreError).code);
        logger.error('❌ Listener error message:', (error as FirestoreError).message);

        // Only treat specific errors as offline-worthy
        const errorCode = (error as any)?.code;
        const isNetworkError =
          errorCode === 'unavailable' ||
          errorCode === 'deadline-exceeded' ||
          errorCode === 'cancelled';

        const isQuotaError =
          errorCode === 'resource-exhausted' ||
          (error as Error).message?.includes('Quota exceeded');

        // For most listener errors, just log them but don't go offline
        // Only go offline for clear network/quota issues
        if (isNetworkError || isQuotaError) {
          logger.log('🚫 Listener network/quota error - staying online but logging');
          // Don't automatically go offline for listener errors
          // The app can still function and retry operations
        }
      }
    );

    return () => {
      logger.log('🛑 Cleaning up real-time listener');
      unsubscribe();
    };
  }, [currentUser, ignoreRemoteChanges]);

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
          setTimeout(() => processActionQueue(), 1000);
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
  }, [syncStatus, actionQueue.length, isOnline, processActionQueue]);

  // Smart quota reset detection (hourly at 2 minutes past the hour)
  useEffect(() => {
    // Only run quota reset checks when in offline quota error state
    if (syncStatus === 'error' && !isOnline) {
      logger.log('⏰ Setting up smart quota reset detection (hourly at :02)');

      const scheduleNextQuotaCheck = (): NodeJS.Timeout => {
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
            loadOfflineData();

            // Process any queued actions
            setTimeout(() => {
              logger.log('🔄 Processing queued actions after quota restoration');
              processActionQueue();
            }, 2000);
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
  }, [syncStatus, isOnline, loadOfflineData, processActionQueue]);

  // localStorage persistence functions defined above with useCallback

  // Export user data to file
  function exportUserData(): void {
    if (!userData) {
      throw new Error('No user data to export');
    }

    const exportData = {
      allCrates: userData.allCrates,
      config: userData.config,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crate-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import user data from file
  function importUserData(file: File): Promise<AppState> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const importedData = JSON.parse((e.target as FileReader).result as string);

          // Validate the imported data structure
          if (
            !importedData.allCrates ||
            !Array.isArray(importedData.allCrates) ||
            !importedData.config ||
            typeof importedData.config !== 'object'
          ) {
            throw new Error('Invalid file format');
          }

          // Merge with current data or replace completely
          const mergedData: AppState = {
            allCrates: importedData.allCrates,
            config: {
              wins: importedData.config.wins || 0,
              gpWins: importedData.config.gpWins || 0,
            },
          };

          resolve(mergedData);
        } catch (error) {
          reject(new Error('Failed to parse file: ' + (error as Error).message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  const value: AuthContextType = {
    currentUser,
    login: signInWithGoogle,
    register: signInWithGoogle, // Using Google auth for both login and register
    logout,
    loading: loading || authLoading,
    // Additional properties not in the original AuthContextType but needed by the app
    userData,
    saveUserData: currentUser
      ? (data: AppState) => saveUserData(currentUser.uid, data)
      : () => {
          logger.warn('Cannot save data - no authenticated user');
          return Promise.resolve(false);
        },
    loadUserData: currentUser
      ? () => loadUserData(currentUser.uid)
      : () => ({ allCrates: [], config: { wins: 0, gpWins: 0 } }),
    setIgnoreRemoteChanges,
    exportUserData,
    importUserData,
    // Offline sync features
    isOnline,
    syncStatus,
    actionQueue,
    processActionQueue,
    queueAction,
    // localStorage functions
    saveOfflineData,
    loadOfflineData,
    clearOfflineData,
    // Auth specific properties
    signInWithGoogle,
    authLoading,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
