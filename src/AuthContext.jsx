import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, checkNetworkStatus } from './firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [ignoreRemoteChanges, setIgnoreRemoteChanges] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced', 'syncing', 'pending', 'error'
  const [actionQueue, setActionQueue] = useState([]);

  // Google sign in
  async function signInWithGoogle() {
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  // Sign out
  async function logout() {
    setAuthLoading(true);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  // Load user data from Firestore
  async function loadUserData(userId) {
    console.log('📥 Loading user data for:', userId?.substring(0, 8) + '...');

    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        console.log('✅ User data loaded successfully');
        return userDoc.data();
      } else {
        console.log('📝 Creating new user document');
        // Create default user data if it doesn't exist
        const defaultData = {
          allCrates: [],
          config: { wins: 0, gpWins: 0 }
        };
        try {
          await setDoc(userDocRef, defaultData);
          console.log('✅ Default user data created');
        } catch (createError) {
          console.error('❌ Error creating default user data:', createError);
          console.error('❌ Create error code:', createError.code);
          console.error('❌ Create error message:', createError.message);
          // Continue with default data even if save fails
        }
        return defaultData;
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      console.error('❌ Load error code:', error.code);
      console.error('❌ Load error message:', error.message);

      // Only treat as offline for specific network/quota errors
      const isNetworkError = error.code === 'unavailable' ||
                           error.code === 'deadline-exceeded' ||
                           error.code === 'cancelled';

      const isQuotaError = error.code === 'resource-exhausted' ||
                          error.message?.includes('Quota exceeded');

      if (isNetworkError || isQuotaError) {
        console.log('🚫 Network/quota error detected - staying online but will retry');
        setSyncStatus('pending');
      }

      // Return default data if Firestore fails
      return { allCrates: [], config: { wins: 0, gpWins: 0 } };
    }
  }

  // Enhanced save user data with offline support and retry logic
  async function saveUserData(userId, data, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff

    console.log('🔄 saveUserData called with:', { userId: userId?.substring(0, 8) + '...', dataKeys: Object.keys(data), retryCount });

    try {
      console.log('💾 Saving user data to Firestore...');
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, data, { merge: true });
      setSyncStatus('synced');
      console.log('✅ Firestore save successful');
      return true; // Success
    } catch (error) {
      console.error('❌ Error saving user data to Firestore:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);

      // Check if it's a network-related error (retry these)
      const isNetworkError = error.code === 'unavailable' ||
                           error.code === 'deadline-exceeded' ||
                           error.code === 'cancelled' ||
                           error.message?.includes('network') ||
                           error.message?.includes('offline');

      // Check if it's a quota/resource error (don't retry these)
      const isQuotaError = error.code === 'resource-exhausted' ||
                          error.message?.includes('Quota exceeded') ||
                          error.message?.includes('quota') ||
                          error.message?.includes('limit');

      if (isNetworkError && retryCount < maxRetries) {
        setSyncStatus('pending');
        console.log(`Retrying save operation in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);

        // Return a promise that resolves after the retry delay
        return new Promise((resolve) => {
          setTimeout(async () => {
            try {
              const result = await saveUserData(userId, data, retryCount + 1);
              resolve(result);
            } catch (retryError) {
              console.error('Retry failed:', retryError);
              resolve(false); // Failed after retry
            }
          }, retryDelay);
        });
      } else if (isQuotaError) {
        // For quota errors, immediately go offline without retrying
        setIsOnline(false);
        setSyncStatus('error');
        console.error('Quota exceeded - switching to offline mode:', error.message);

        // Queue the action for later when quota is restored
        queueAction('save', { userId, data });
        return false; // Failed
      } else {
        // For other non-network errors or max retries reached, treat as offline
        setIsOnline(false);
        setSyncStatus('error');
        console.error('Save failed after retries or due to non-network error:', error.message);

        // Queue the action for later when back online
        queueAction('save', { userId, data });
        return false; // Failed
      }
    }
  }

  // Action queue for offline operations
  function queueAction(type, payload) {
    const action = {
      id: Date.now() + Math.random(),
      type,
      payload,
      timestamp: new Date().toISOString()
    };

    setActionQueue(prev => [...prev, action]);
    console.log('Action queued:', action);
  }

  // Process queued actions when back online
  async function processActionQueue() {
    if (actionQueue.length === 0) return;

    setSyncStatus('syncing');
    const actionsToProcess = [...actionQueue];
    setActionQueue([]);

    for (const action of actionsToProcess) {
      try {
        switch (action.type) {
          case 'save':
            const success = await saveUserData(action.payload.userId, action.payload.data);
            if (!success) {
              console.error('Failed to process queued save action');
              // Re-queue if it fails
              setActionQueue(prev => [...prev, action]);
            }
            break;
          default:
            console.warn('Unknown action type:', action.type);
        }
      } catch (error) {
        console.error('Failed to process queued action:', error);
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
  }

  // Check network status and process queue when coming back online
  useEffect(() => {
    // Only process queue if we're online AND not in error state
    if (isOnline && actionQueue.length > 0 && syncStatus !== 'error') {
      console.log('🔄 Processing action queue - back online');
      processActionQueue();
    } else if (syncStatus === 'error' && actionQueue.length > 0) {
      console.log('⏸️ Skipping action queue processing due to error state');
    }
  }, [isOnline, actionQueue.length, syncStatus]);

  // Listen for global Firebase quota exceeded events
  useEffect(() => {
    const handleQuotaExceeded = (event) => {
      console.log('🚨 Received global quota exceeded event:', event.detail);
      console.log('🚨 Current state before offline switch - isOnline:', isOnline, 'syncStatus:', syncStatus);

      // Force offline mode and disable network
      setIsOnline(false);
      setSyncStatus('error');

      // Also force disable Firestore network to prevent further operations
      import('./firebase').then(({ forceOfflineMode }) => {
        forceOfflineMode();
      });

      console.log('🚨 Successfully switched to offline mode due to quota exceeded');
    };

    const handleOperationBlocked = (event) => {
      console.log('🚨 Received blocked operation event:', event.detail);
      console.log('🚨 Firebase operation blocked by client - switching to offline mode');

      // Treat blocked operations as offline scenario
      setIsOnline(false);
      setSyncStatus('error');

      // Disable Firestore network to prevent further blocked requests
      import('./firebase').then(({ forceOfflineMode }) => {
        forceOfflineMode();
      });

      console.log('🚨 Successfully switched to offline mode due to blocked operations');
    };

    console.log('🔧 Setting up global Firebase event listeners');
    window.addEventListener('firebase-quota-exceeded', handleQuotaExceeded);
    window.addEventListener('firebase-operation-blocked', handleOperationBlocked);

    return () => {
      console.log('🔧 Removing global Firebase event listeners');
      window.removeEventListener('firebase-quota-exceeded', handleQuotaExceeded);
      window.removeEventListener('firebase-operation-blocked', handleOperationBlocked);
    };
  }, [isOnline, syncStatus]);

  // Removed localStorage functions - using only Firestore now

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔐 Auth state changed:', user ? 'signed in' : 'signed out');

      if (user) {
        // User is signed in - reset connection state and load their data
        console.log('🔐 User signed in, resetting connection state');
        setIsOnline(true);
        setSyncStatus('synced');
        setCurrentUser(user);
        setLoading(true);

        try {
          const data = await loadUserData(user.uid);
          setUserData(data);
          console.log('✅ User data loaded successfully after sign in');
        } catch (error) {
          console.error('❌ Failed to load user data after sign in:', error);
          setUserData({ allCrates: [], config: { wins: 0, gpWins: 0 } });
        }
      } else {
        // User is signed out, clear data
        console.log('🔐 User signed out, clearing data');
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
      console.log('⏸️ No current user - skipping real-time listener setup');
      return;
    }

    // Always try to set up the listener when we have a current user
    console.log('🔄 Setting up real-time listener for user:', currentUser.uid.substring(0, 8) + '...');
    const userDocRef = doc(db, 'users', currentUser.uid);

    const unsubscribe = onSnapshot(
      userDocRef,
      (doc) => {
        if (doc.exists() && !ignoreRemoteChanges) {
          console.log('📡 Real-time data update received from Firebase');
          setUserData(doc.data());
        }
      },
      (error) => {
        console.error('❌ Real-time listener error:', error);
        console.error('❌ Listener error code:', error.code);
        console.error('❌ Listener error message:', error.message);

        // Only treat specific errors as offline-worthy
        const isNetworkError = error.code === 'unavailable' ||
                             error.code === 'deadline-exceeded' ||
                             error.code === 'cancelled';

        const isQuotaError = error.code === 'resource-exhausted' ||
                            error.message?.includes('Quota exceeded');

        // For most listener errors, just log them but don't go offline
        // Only go offline for clear network/quota issues
        if (isNetworkError || isQuotaError) {
          console.log('🚫 Listener network/quota error - staying online but logging');
          // Don't automatically go offline for listener errors
          // The app can still function and retry operations
        }
      }
    );

    return () => {
      console.log('🛑 Cleaning up real-time listener');
      unsubscribe();
    };
  }, [currentUser, ignoreRemoteChanges]);

  // Monitor network status by testing connectivity on errors
  useEffect(() => {
    const checkConnection = async () => {
      // Don't check connection if we're in quota error state
      if (syncStatus === 'error' && !isOnline) {
        console.log('⏸️ Skipping connection check due to quota error state');
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
  }, [syncStatus, actionQueue.length, isOnline]);

  // Smart quota reset detection (hourly at 2 minutes past the hour)
  useEffect(() => {
    // Only run quota reset checks when in offline quota error state
    if (syncStatus === 'error' && !isOnline) {
      console.log('⏰ Setting up smart quota reset detection (hourly at :02)');

      const scheduleNextQuotaCheck = () => {
        const now = new Date();
        const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 2, 0);
        const millisecondsUntilNextCheck = nextHour.getTime() - now.getTime();

        console.log(`⏰ Next quota check scheduled for: ${nextHour.toLocaleTimeString()} (${Math.round(millisecondsUntilNextCheck / 60000)} minutes)`);

        return setTimeout(() => {
          performQuotaCheck();
        }, millisecondsUntilNextCheck);
      };

      const performQuotaCheck = async () => {
        console.log('🔄 Checking if Firebase quota has been restored...');

        try {
          // Try a minimal Firebase operation to test quota
          const networkAvailable = await checkNetworkStatus();

          if (networkAvailable) {
            console.log('✅ Firebase quota appears to be restored!');
            setIsOnline(true);
            setSyncStatus('syncing');

            // Load any offline data from localStorage first
            loadOfflineData();

            // Process any queued actions
            setTimeout(() => {
              console.log('🔄 Processing queued actions after quota restoration');
              processActionQueue();
            }, 2000);
          } else {
            console.log('⏸️ Firebase quota still exceeded - scheduling next check');
            // Schedule next check (will be at next hour :02)
            scheduleNextQuotaCheck();
          }
        } catch (error) {
          // Check if it's still a quota error or a different error
          const isStillQuotaError = error.code === 'resource-exhausted' ||
                                  error.message?.includes('Quota exceeded');

          if (isStillQuotaError) {
            console.log('⏸️ Quota still exceeded - scheduling next check');
            scheduleNextQuotaCheck();
          } else {
            console.log('⚠️ Different error detected:', error.message);
            // Could be network issues, schedule next check anyway
            scheduleNextQuotaCheck();
          }
        }
      };

      // Schedule first check
      const firstCheckTimeout = scheduleNextQuotaCheck();

      return () => {
        console.log('🛑 Clearing quota reset detection timeout');
        clearTimeout(firstCheckTimeout);
      };
    }
  }, [syncStatus, isOnline]);

  // localStorage persistence for offline data
  const saveOfflineData = (data) => {
    if (currentUser) {
      try {
        const offlineData = {
          data,
          queuedActions: actionQueue,
          timestamp: new Date().toISOString(),
          userId: currentUser.uid
        };

        const dataString = JSON.stringify(offlineData);
        localStorage.setItem(`crate-tracker-offline-${currentUser.uid}`, dataString);

        // Verify it was saved
        const saved = localStorage.getItem(`crate-tracker-offline-${currentUser.uid}`);
        if (saved === dataString) {
          console.log('💾 Successfully saved offline data to localStorage');
          console.log('💾 Data preview:', { wins: data.config.wins, crates: data.allCrates.length });
        } else {
          console.error('❌ Failed to save offline data to localStorage');
        }
      } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
      }
    }
  };

  const loadOfflineData = () => {
    if (currentUser) {
      const key = `crate-tracker-offline-${currentUser.uid}`;
      console.log('🔍 Looking for localStorage key:', key);

      const savedData = localStorage.getItem(key);
      console.log('📦 Raw localStorage data:', savedData);

      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          const { data, queuedActions, timestamp } = parsedData;

          console.log('📤 Loaded offline data from localStorage:');
          console.log('  - Timestamp:', timestamp);
          console.log('  - Wins:', data.config.wins);
          console.log('  - Crates:', data.allCrates.length);
          console.log('  - Queued actions:', queuedActions.length);

          // Don't automatically set state - return the data for App.jsx to handle
          console.log('✅ Retrieved offline data from localStorage');
          return data;
        } catch (error) {
          console.error('❌ Failed to parse localStorage data:', error);
          console.error('❌ Raw data that failed to parse:', savedData);
          return null;
        }
      } else {
        console.log('ℹ️ No localStorage data found for key:', key);
      }
    }
    return null;
  };

  const clearOfflineData = () => {
    if (currentUser) {
      localStorage.removeItem(`crate-tracker-offline-${currentUser.uid}`);
      console.log('🗑️ Cleared offline data from localStorage');
    }
  };

  // Export user data to file
  function exportUserData() {
    if (!userData) {
      throw new Error('No user data to export');
    }

    const exportData = {
      allCrates: userData.allCrates,
      config: userData.config,
      exportedAt: new Date().toISOString()
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
  function importUserData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);

          // Validate the imported data structure
          if (!importedData.allCrates || !Array.isArray(importedData.allCrates) ||
              !importedData.config || typeof importedData.config !== 'object') {
            throw new Error('Invalid file format');
          }

          // Merge with current data or replace completely
          const mergedData = {
            allCrates: importedData.allCrates,
            config: {
              wins: importedData.config.wins || 0,
              gpWins: importedData.config.gpWins || 0
            }
          };

          resolve(mergedData);
        } catch (error) {
          reject(new Error('Failed to parse file: ' + error.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  const value = {
    currentUser,
    userData,
    loading,
    authLoading,
    signInWithGoogle,
    logout,
    saveUserData: currentUser ? (data) => saveUserData(currentUser.uid, data) : () => console.warn('Cannot save data - no authenticated user'),
    loadUserData: currentUser ? () => loadUserData(currentUser.uid) : () => ({ allCrates: [], config: { wins: 0, gpWins: 0 } }),
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
    clearOfflineData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
