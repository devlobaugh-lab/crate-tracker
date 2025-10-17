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
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        return userDoc.data();
      } else {
        // Create default user data if it doesn't exist
        const defaultData = {
          allCrates: [],
          config: { wins: 0, gpWins: 0 }
        };
        await setDoc(userDocRef, defaultData);
        return defaultData;
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Return default data if Firestore fails (no localStorage fallback)
      return { allCrates: [], config: { wins: 0, gpWins: 0 } };
    }
  }

  // Enhanced save user data with offline support and retry logic
  async function saveUserData(userId, data, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 1000 * Math.pow(2, retryCount); // Exponential backoff

    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, data, { merge: true });
      setSyncStatus('synced');
      console.log('Firestore save successful');
    } catch (error) {
      console.error('Error saving user data to Firestore:', error);

      // Check if it's a network-related error
      const isNetworkError = error.code === 'unavailable' ||
                           error.code === 'deadline-exceeded' ||
                           error.code === 'cancelled' ||
                           error.message?.includes('network');

      if (isNetworkError && retryCount < maxRetries) {
        setSyncStatus('pending');
        console.log(`Retrying save operation in ${retryDelay}ms (attempt ${retryCount + 1}/${maxRetries})`);

        setTimeout(() => {
          saveUserData(userId, data, retryCount + 1);
        }, retryDelay);
      } else {
        // For non-network errors or max retries reached, treat as offline
        setIsOnline(false);
        setSyncStatus('error');
        console.error('Save failed after retries or due to non-network error:', error.message);

        // Queue the action for later when back online
        queueAction('save', { userId, data });
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
            await saveUserData(action.payload.userId, action.payload.data);
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

    setSyncStatus('synced');
  }

  // Check network status and process queue when coming back online
  useEffect(() => {
    if (isOnline && actionQueue.length > 0) {
      processActionQueue();
    }
  }, [isOnline, actionQueue.length]);

  // Removed localStorage functions - using only Firestore now

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(true);

      if (user) {
        // User is signed in, load their data
        const data = await loadUserData(user.uid);

        setUserData(data);
      } else {
        // User is signed out, clear data
        setUserData(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Set up real-time listener for user data changes
  useEffect(() => {
    if (!currentUser) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists() && !ignoreRemoteChanges) {
        setUserData(doc.data());
      }
    }, (error) => {
      console.error('Error listening to user data:', error);

      // Check if this is a network error
      const isNetworkError = error.code === 'unavailable' ||
                           error.code === 'deadline-exceeded' ||
                           error.code === 'cancelled';

      if (isNetworkError) {
        setIsOnline(false);
        setSyncStatus('error');
      }
    });

    return unsubscribe;
  }, [currentUser, ignoreRemoteChanges]);

  // Monitor network status by testing connectivity on errors
  useEffect(() => {
    const checkConnection = async () => {
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

    // Check connection when there are errors or pending actions
    if (syncStatus === 'error' || actionQueue.length > 0) {
      const timeoutId = setTimeout(checkConnection, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [syncStatus, actionQueue.length, isOnline]);

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
    queueAction
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
