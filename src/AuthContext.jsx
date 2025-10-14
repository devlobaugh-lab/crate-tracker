import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
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
      // Fallback to localStorage if Firestore fails
      return loadFromLocalStorage();
    }
  }

  // Save user data to Firestore
  async function saveUserData(userId, data) {
    try {
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, data, { merge: true });
    } catch (error) {
      console.error('Error saving user data:', error);
      // Fallback to localStorage if Firestore fails
      saveToLocalStorage(data);
    }
  }

  // LocalStorage fallback functions
  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem('crate-tracker:v1');
      return raw ? JSON.parse(raw) : { allCrates: [], config: { wins: 0, gpWins: 0 } };
    } catch (e) {
      console.error('Failed to read localStorage', e);
      return { allCrates: [], config: { wins: 0, gpWins: 0 } };
    }
  }

  function saveToLocalStorage(state) {
    try {
      localStorage.setItem('crate-tracker:v1', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to write localStorage', e);
    }
  }

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(true);

      if (user) {
        // User is signed in, load their data
        const data = await loadUserData(user.uid);

        // Check if this is a new user and migrate localStorage data
        if (data && data.allCrates.length === 0 && data.config.wins === 0 && data.config.gpWins === 0) {
          const localData = loadFromLocalStorage();
          if (localData && (localData.allCrates.length > 0 || localData.config.wins > 0)) {
            // Migrate localStorage data to Firestore
            await saveUserData(user.uid, localData);
            setUserData(localData);
          } else {
            setUserData(data);
          }
        } else {
          setUserData(data);
        }
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
    });

    return unsubscribe;
  }, [currentUser, ignoreRemoteChanges]);

  const value = {
    currentUser,
    userData,
    loading,
    authLoading,
    signInWithGoogle,
    logout,
    saveUserData: currentUser ? (data) => saveUserData(currentUser.uid, data) : saveToLocalStorage,
    loadUserData: currentUser ? () => loadUserData(currentUser.uid) : loadFromLocalStorage,
    setIgnoreRemoteChanges
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
