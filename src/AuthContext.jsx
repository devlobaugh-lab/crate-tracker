import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

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
  const [currentSessionId, setCurrentSessionId] = useState(null);

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
      // Cleanup session before signing out
      if (currentSessionId) {
        await cleanupSession(currentSessionId);
        setCurrentSessionId(null);
      }
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

  // Save user data to Firestore
  async function saveUserData(userId, data) {
    // console.log('saveUserData called with:', { userId, data });
    try {
      const userDocRef = doc(db, 'users', userId);
      // console.log('Attempting to save to Firestore path: users/' + userId);
      await setDoc(userDocRef, data, { merge: true });
      // console.log('Firestore save successful');
    } catch (error) {
      console.error('Error saving user data to Firestore:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      // Fallback to localStorage if Firestore fails
      // saveToLocalStorage(data);
    }
  }

  // Removed localStorage functions - using only Firestore now

  // Session management functions
  async function createSession(userId) {
    const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionData = {
      sessionId,
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      userAgent: navigator.userAgent,
      isActive: true
    };

    try {
      await setDoc(doc(db, 'sessions', sessionId), sessionData);
      setCurrentSessionId(sessionId);
      return sessionId;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async function invalidateOtherSessions(userId, currentSessionId) {
    try {
      const sessionsRef = collection(db, 'sessions');
      const q = query(sessionsRef, where('userId', '==', userId), where('isActive', '==', true));
      const querySnapshot = await getDocs(q);

      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        if (doc.id !== currentSessionId) {
          batch.update(doc.ref, { isActive: false, invalidatedAt: new Date() });
        }
      });

      await batch.commit();
      console.log(`Invalidated ${querySnapshot.size - 1} other sessions for user ${userId}`);
    } catch (error) {
      console.error('Error invalidating other sessions:', error);
      throw error;
    }
  }

  async function validateCurrentSession(sessionId) {
    try {
      const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        return sessionData.isActive && sessionData.userId === currentUser?.uid;
      }
      return false;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }

  async function updateSessionActivity(sessionId) {
    try {
      await setDoc(doc(db, 'sessions', sessionId), {
        lastActivity: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  async function cleanupSession(sessionId) {
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
      console.log(`Cleaned up session ${sessionId}`);
    } catch (error) {
      console.error('Error cleaning up session:', error);
    }
  }

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? 'signed in' : 'signed out');
      setCurrentUser(user);
      setLoading(true);

      if (user) {
        // User is signed in, load their data and manage sessions
        const data = await loadUserData(user.uid);
        setUserData(data);

        // Create new session and invalidate other sessions
        try {
          const sessionId = await createSession(user.uid);
          console.log('Created session:', sessionId);
          await invalidateOtherSessions(user.uid, sessionId);
          console.log('Invalidated other sessions for user:', user.uid);
        } catch (error) {
          console.error('Error managing sessions on sign in:', error);
        }
      } else {
        // User is signed out, clear data and cleanup session
        setUserData(null);
        if (currentSessionId) {
          console.log('Cleaning up session:', currentSessionId);
          await cleanupSession(currentSessionId);
          setCurrentSessionId(null);
        }
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []); // Remove currentSessionId dependency to avoid circular issues

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
    });

    return unsubscribe;
  }, [currentUser, ignoreRemoteChanges]);

  // Set up session monitoring to detect when current session becomes invalid
  useEffect(() => {
    if (!currentUser || !currentSessionId) return;

    console.log('Setting up session monitoring for:', currentSessionId);

    // Add a small delay to allow session document to be fully created
    const monitoringTimeout = setTimeout(() => {
      const sessionDocRef = doc(db, 'sessions', currentSessionId);
      const unsubscribe = onSnapshot(sessionDocRef, async (doc) => {
        if (doc.exists()) {
          const sessionData = doc.data();
          console.log('Session data received:', sessionData);

          if (!sessionData.isActive) {
            console.log('Current session has been invalidated, logging out...');
            // Session has been invalidated, log out the user
            try {
              await signOut(auth);
              setCurrentUser(null);
              setUserData(null);
              setCurrentSessionId(null);
              alert('You have been logged out because you signed in from another device or tab.');
            } catch (error) {
              console.error('Error during forced logout:', error);
            }
          } else {
            // Session is active, just log it for debugging
            console.log('Session is active and valid');
          }
        } else {
          console.log('Session document not found during monitoring:', currentSessionId);
          // Session document doesn't exist, log out
          try {
            await signOut(auth);
            setCurrentUser(null);
            setUserData(null);
            setCurrentSessionId(null);
          } catch (error) {
            console.error('Error during logout after session not found:', error);
          }
        }
      }, (error) => {
        console.error('Error monitoring session:', error);
      });

      return unsubscribe;
    }, 1000); // Wait 1 second before starting monitoring

    return () => clearTimeout(monitoringTimeout);
  }, [currentUser, currentSessionId]);

  // Activity monitoring to keep session alive
  useEffect(() => {
    if (!currentSessionId) return;

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const updateActivity = () => {
      updateSessionActivity(currentSessionId);
    };

    // Update activity on user interactions
    activityEvents.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Also update activity periodically (every 5 minutes)
    const intervalId = setInterval(updateActivity, 5 * 60 * 1000);

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
      clearInterval(intervalId);
    };
  }, [currentSessionId]);

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
    importUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
