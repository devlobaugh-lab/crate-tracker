import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  // GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, FirestoreError } from 'firebase/firestore';
import { auth, db, googleProvider, forceOfflineMode } from './firebase.ts';
import { User, AuthContextType } from './types';
import logger from './utils/logger';
import AuthorizationService from './utils/authorization';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useDebouncedSave } from './hooks/useDebouncedSave';
import { saveAs } from 'file-saver';
import { validateFileUpload, migrateToMultiSeries, ImportResult } from './utils/validation';
import { notifications } from './utils/notifications';

// Define the state interface
interface AppState {
  series: { allCrates: string[] }[];
  config: {
    wins: number;
    gpWins: number;
  };
}

const DEFAULT_APP_STATE: AppState = {
  series: Array.from({ length: 12 }, () => ({ allCrates: [] })),
  config: { wins: 0, gpWins: 0 },
};

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
  const [wasMigrated, setWasMigrated] = useState<boolean>(false);
  const [authorizationStatus, setAuthorizationStatus] = useState<
    'checking' | 'authorized' | 'unauthorized'
  >('checking');

  // Use extracted hooks for offline sync and data persistence
  const offlineSync = useOfflineSync({
    currentUser,
    onQuotaExceeded: () => {
      // Force disable Firestore network to prevent further operations
      forceOfflineMode();
    },
    onOperationBlocked: () => {
      // Disable Firestore network to prevent further blocked requests
      forceOfflineMode();
    },
  });

  const { saveUserData: debouncedSaveUserData } = useDebouncedSave({
    setSyncStatus: () => {}, // Will be handled by offlineSync hook
    setIsOnline: () => {}, // Will be handled by offlineSync hook
    queueAction: offlineSync.queueAction,
  });

  // Google sign in
  async function signInWithGoogle(): Promise<void> {
    setAuthLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      logger.log('✅ Google sign in successful:', result.user.email);
      // The authentication state change will be handled by onAuthStateChanged
    } catch (error: any) {
      logger.error('Error signing in with Google:', error);

      // Check if this is a Cross-Origin-Opener-Policy related error
      if (
        error?.message?.includes('Cross-Origin-Opener-Policy') ||
        error?.message?.includes('window.closed') ||
        error?.message?.includes('opener')
      ) {
        logger.log(
          '🔄 COOP policy detected, user may need to refresh or use different browser settings'
        );

        // Show a user-friendly error message for COOP issues
        const coopError = new Error(
          'Authentication popup was blocked due to browser security settings. ' +
            'Please try disabling browser extensions that may add security headers, ' +
            'or use an incognito/private window.'
        );
        coopError.name = 'COOPPolicyError';
        setAuthLoading(false);
        throw coopError;
      }

      setAuthLoading(false);
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

  /**
   * Loads user data from Firestore, migrating legacy single-series data to
   * the 12-series format if needed. If migration ran, writes the result back
   * to Firestore immediately (one-time, non-debounced).
   *
   * @param userId - The Firebase user ID to load data for
   * @returns Promise resolving to { data: AppState, wasMigrated: boolean }
   */
  async function loadUserData(userId: string): Promise<{ data: AppState; wasMigrated: boolean }> {
    logger.log('📥 Loading user data for:', userId?.substring(0, 8) + '...');

    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        logger.log('✅ User data loaded successfully');
        const rawData = userDoc.data();
        const { data, migrated } = migrateToMultiSeries(rawData);

        if (migrated) {
          logger.log('🔄 Legacy data detected — migrating to multi-series format');
          try {
            await setDoc(userDocRef, data);
            logger.log('✅ Migration data written back to Firestore');
          } catch (writeError) {
            logger.error('❌ Failed to write migration data to Firestore:', writeError);
          }
        }

        return { data, wasMigrated: migrated };
      } else {
        logger.log('📝 Creating new user document');
        try {
          await setDoc(userDocRef, DEFAULT_APP_STATE);
          logger.log('✅ Default user data created');
        } catch (createError) {
          logger.error('❌ Error creating default user data:', createError);
          logger.error('❌ Create error code:', (createError as FirestoreError).code);
          logger.error('❌ Create error message:', (createError as FirestoreError).message);
        }
        return { data: DEFAULT_APP_STATE, wasMigrated: false };
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
      }

      return { data: DEFAULT_APP_STATE, wasMigrated: false };
    }
  }

  // Create wrapper functions that use the hook's processActionQueue with debouncedSaveUserData
  const processActionQueue = useCallback(async (): Promise<void> => {
    await offlineSync.processActionQueue(debouncedSaveUserData);
  }, [offlineSync, debouncedSaveUserData]);

  /**
   * Firebase Authentication State Change Handler
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      logger.log('🔐 Auth state changed:', user ? 'signed in' : 'signed out');

      if (user) {
        logger.log('🔐 Firebase auth successful, checking authorization...');
        setAuthorizationStatus('checking');

        const userEmail = user.email;
        if (!userEmail) {
          logger.error('❌ No email found for authenticated user');
          setAuthorizationStatus('unauthorized');
          setLoading(false);
          return;
        }

        const authorizationResult = await AuthorizationService.checkUserAuthorization(userEmail);

        if (!authorizationResult.authorized) {
          logger.log(`🚫 User ${userEmail} not authorized to use this app`);
          logger.log('Authorization result:', authorizationResult);
          setAuthorizationStatus('unauthorized');
          setCurrentUser({
            uid: user.uid,
            email: userEmail,
            displayName: user.displayName || undefined,
            photoURL: user.photoURL || undefined,
            role: 'normal',
            authorized: false,
          });
          setUserData(null);
          setLoading(false);
          return;
        }

        logger.log(
          `✅ User ${userEmail} authorized as ${authorizationResult.role}, proceeding with app initialization`
        );

        setAuthorizationStatus('authorized');
        setCurrentUser({
          uid: user.uid,
          email: userEmail,
          displayName: user.displayName || undefined,
          photoURL: user.photoURL || undefined,
          role: authorizationResult.role,
          authorized: true,
        });

        setLoading(true);
        try {
          const { data, wasMigrated: migrated } = await loadUserData(user.uid);
          setUserData(data);
          setWasMigrated(migrated);
          logger.log('✅ User data loaded successfully after authorization check');
        } catch (error) {
          logger.error('❌ Failed to load user data after authorization check:', error);
          setUserData(DEFAULT_APP_STATE);
        }
      } else {
        logger.log('🔐 User signed out, clearing data');
        setCurrentUser(null);
        setUserData(null);
        setWasMigrated(false);
        setAuthorizationStatus('checking');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Real-time Firestore Listener for User Data Changes
   */
  useEffect(() => {
    if (!currentUser) {
      logger.log('⏸️ No current user - skipping real-time listener setup');
      return;
    }

    logger.log(
      '🔄 Setting up real-time listener for user:',
      currentUser.uid.substring(0, 8) + '...'
    );
    const userDocRef = doc(db, 'users', currentUser.uid);

    const unsubscribe = onSnapshot(
      userDocRef,
      snapshot => {
        if (snapshot.exists() && !ignoreRemoteChanges) {
          logger.log('📡 Real-time data update received from Firebase');
          const rawData = snapshot.data();
          const { data } = migrateToMultiSeries(rawData);
          setUserData(data);
        }
      },
      error => {
        logger.error('❌ Real-time listener error:', error);
        logger.error('❌ Listener error code:', (error as FirestoreError).code);
        logger.error('❌ Listener error message:', (error as FirestoreError).message);

        const errorCode = (error as any)?.code;
        const isNetworkError =
          errorCode === 'unavailable' ||
          errorCode === 'deadline-exceeded' ||
          errorCode === 'cancelled';

        const isQuotaError =
          errorCode === 'resource-exhausted' ||
          (error as Error).message?.includes('Quota exceeded');

        if (isNetworkError || isQuotaError) {
          logger.log('🚫 Listener network/quota error - staying online but logging');
        }
      }
    );

    return () => {
      logger.log('🛑 Cleaning up real-time listener');
      unsubscribe();
    };
  }, [currentUser, ignoreRemoteChanges]);

  // Export user data to file (v2 format with all 12 series)
  function exportUserData(): void {
    if (!userData) {
      throw new Error('No user data to export');
    }

    const exportData = {
      version: 2,
      series: userData.series,
      config: userData.config,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const filename = `crate-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;

    saveAs(blob, filename);
    notifications.success('Data exported successfully', { filename });
    logger.log('📁 User data exported successfully:', filename);
  }

  // Import user data from file
  // Returns a typed union:
  //   { type: 'full', data: ... }  — v2 file, replaces all series + config
  //   { type: 'single', allCrates: string[] } — legacy file, imports into current series only
  function importUserData(file: File): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      try {
        const validatedFile = validateFileUpload(file);

        const reader = new FileReader();
        reader.onload = e => {
          try {
            const rawData = JSON.parse((e.target as FileReader).result as string);

            // v2 format: has version: 2 and series array
            if (rawData.version === 2 && Array.isArray(rawData.series)) {
              const { data } = migrateToMultiSeries(rawData);
              logger.log('📁 v2 import: full restore', {
                series: data.series.length,
                wins: data.config.wins,
              });
              resolve({ type: 'full', data: { series: data.series, config: data.config } });
              return;
            }

            // Legacy format: has allCrates array (no version)
            if (Array.isArray(rawData.allCrates)) {
              logger.log('📁 Legacy import: single-series restore', {
                crates: rawData.allCrates.length,
              });
              resolve({ type: 'single', allCrates: rawData.allCrates });
              return;
            }

            reject(new Error('Invalid file format: missing series or allCrates field'));
          } catch (parseError) {
            reject(new Error('Failed to parse file: ' + (parseError as Error).message));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(validatedFile);
      } catch (validationError) {
        reject(validationError);
      }
    });
  }

  const value: any = {
    currentUser,
    login: signInWithGoogle,
    register: signInWithGoogle, // Using Google auth for both login and register
    logout,
    loading: loading || authLoading,
    // Additional properties not in the original AuthContextType but needed by the app
    userData,
    wasMigrated,
    saveUserData: currentUser
      ? (data: AppState) => debouncedSaveUserData(currentUser.uid, data)
      : () => {
          logger.warn('Cannot save data - no authenticated user');
          return Promise.resolve(false);
        },
    loadUserData: currentUser
      ? () => loadUserData(currentUser.uid)
      : () => ({ data: DEFAULT_APP_STATE, wasMigrated: false }),
    setIgnoreRemoteChanges,
    exportUserData,
    importUserData,
    // Offline sync features
    isOnline: offlineSync.isOnline,
    syncStatus: offlineSync.syncStatus,
    actionQueue: offlineSync.actionQueue,
    processActionQueue,
    queueAction: offlineSync.queueAction,
    // localStorage functions
    saveOfflineData: offlineSync.saveOfflineData,
    loadOfflineData: offlineSync.loadOfflineData,
    clearOfflineData: offlineSync.clearOfflineData,
    // Auth specific properties
    signInWithGoogle,
    authLoading,
    // Authorization status
    authorizationStatus,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
