import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  // GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, FirestoreError } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase.ts';
import { User, AuthContextType } from './types';
import logger from './utils/logger';
import AuthorizationService from './utils/authorization';
import { useOfflineSync } from './hooks/useOfflineSync';
import { useDebouncedSave } from './hooks/useDebouncedSave';
import { saveAs } from 'file-saver';
import {
  validateUserDataExport,
  safeValidateUserDataExport,
  validateFileUpload,
} from './utils/validation';

// Define the state interface
interface AppState {
  allCrates: string[];
  config: {
    wins: number;
    gpWins: number;
  };
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
  const [authorizationStatus, setAuthorizationStatus] = useState<
    'checking' | 'authorized' | 'unauthorized'
  >('checking');

  // Use extracted hooks for offline sync and data persistence
  const offlineSync = useOfflineSync({
    currentUser,
    onQuotaExceeded: () => {
      // Force disable Firestore network to prevent further operations
      import('./firebase').then(({ forceOfflineMode }) => {
        forceOfflineMode();
      });
    },
    onOperationBlocked: () => {
      // Disable Firestore network to prevent further blocked requests
      import('./firebase').then(({ forceOfflineMode }) => {
        forceOfflineMode();
      });
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
   * Loads user data from Firestore with fallback to default state.
   * Creates a new user document if one doesn't exist.
   *
   * Business Logic:
   * - First checks if user document exists in Firestore
   * - If exists, returns the stored data
   * - If not exists, creates default user data and saves it
   * - Handles network/quota errors gracefully by returning default data
   * - Logs all operations for debugging
   *
   * Edge Cases:
   * - Network errors: Returns default data without failing
   * - Quota exceeded: Logs error and returns default data
   * - Document creation failure: Continues with default data
   * - Invalid data structure: Handled by Firestore type safety
   *
   * @param userId - The Firebase user ID to load data for
   * @returns Promise resolving to user application state
   */
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
        // Note: sync status is now managed by the offlineSync hook
      }

      // Return default data if Firestore fails
      return { allCrates: [], config: { wins: 0, gpWins: 0 } };
    }
  }

  // Create wrapper functions that use the hook's processActionQueue with debouncedSaveUserData
  const processActionQueue = useCallback(async (): Promise<void> => {
    await offlineSync.processActionQueue(debouncedSaveUserData);
  }, [offlineSync, debouncedSaveUserData]);

  /**
   * Firebase Authentication State Change Handler
   *
   * Business Logic Flow:
   * 1. User signs in with Firebase Auth (Google OAuth)
   * 2. Extract user email from Firebase user object
   * 3. Check if email is authorized using AuthorizationService
   * 4. If authorized: Load user data, set up real-time sync, enable app features
   * 5. If unauthorized: Show unauthorized UI, allow sign-out only
   * 6. If signed out: Clear all user data and reset to initial state
   *
   * Authorization Logic:
   * - Gmail-only access control via authorizedUsers collection
   * - Role-based permissions (admin vs normal users)
   * - Graceful fallback for missing email or auth failures
   *
   * Edge Cases:
   * - No email in Firebase user: Treated as unauthorized
   * - Authorization service failure: Treated as unauthorized
   * - User data load failure: Uses default empty state
   * - Network issues during auth: Maintains current state
   * - Multiple rapid auth changes: Handled by Firebase's internal debouncing
   *
   * State Management:
   * - authorizationStatus: 'checking' | 'authorized' | 'unauthorized'
   * - currentUser: Full user object with role and authorization status
   * - userData: Application state loaded from Firestore
   * - loading: Prevents UI flicker during auth transitions
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
      logger.log('🔐 Auth state changed:', user ? 'signed in' : 'signed out');

      if (user) {
        // User is signed in with Firebase - now check if they are authorized
        logger.log('🔐 Firebase auth successful, checking authorization...');
        setAuthorizationStatus('checking');

        const userEmail = user.email;
        if (!userEmail) {
          logger.error('❌ No email found for authenticated user');
          setAuthorizationStatus('unauthorized');
          setLoading(false);
          return;
        }

        // Check if user is authorized using our service
        const authorizationResult = await AuthorizationService.checkUserAuthorization(userEmail);

        if (!authorizationResult.authorized) {
          logger.log(`🚫 User ${userEmail} not authorized to use this app`);
          logger.log('Authorization result:', authorizationResult);
          setAuthorizationStatus('unauthorized');
          // Keep currentUser so user can sign out, but don't set userData
          setCurrentUser({
            uid: user.uid,
            email: userEmail,
            displayName: user.displayName || undefined,
            photoURL: user.photoURL || undefined,
            role: 'normal', // Default role for unauthorized users
            authorized: false,
          });
          setUserData(null);
          setLoading(false);
          return;
        }

        logger.log(
          `✅ User ${userEmail} authorized as ${authorizationResult.role}, proceeding with app initialization`
        );

        // User is authorized - proceed with normal flow
        setAuthorizationStatus('authorized');
        setCurrentUser({
          uid: user.uid,
          email: userEmail,
          displayName: user.displayName || undefined,
          photoURL: user.photoURL || undefined,
          role: authorizationResult.role,
          authorized: true,
        });

        // Only load user data if they're authorized
        setLoading(true);
        try {
          const data = await loadUserData(user.uid);
          setUserData(data);
          logger.log('✅ User data loaded successfully after authorization check');
        } catch (error) {
          logger.error('❌ Failed to load user data after authorization check:', error);
          setUserData({ allCrates: [], config: { wins: 0, gpWins: 0 } });
        }
      } else {
        // User is signed out, clear all data
        logger.log('🔐 User signed out, clearing data');
        setCurrentUser(null);
        setUserData(null);
        setAuthorizationStatus('checking'); // Reset for new sign-in attempt (not unauthorized)
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Real-time Firestore Listener for User Data Changes
   *
   * Business Logic:
   * - Listens for changes to the user's document in Firestore
   * - Updates local state when remote changes are detected
   * - Respects ignoreRemoteChanges flag to prevent sync conflicts during bulk operations
   * - Handles listener errors gracefully without going offline
   *
   * Synchronization Strategy:
   * - Real-time updates ensure multiple devices stay in sync
   * - ignoreRemoteChanges prevents conflicts during fast-forward operations
   * - Listener errors are logged but don't trigger offline mode
   * - Automatic cleanup when user signs out
   *
   * Edge Cases:
   * - Document doesn't exist: Listener waits for creation
   * - Network errors: Logged but listener remains active
   * - Permission errors: Logged but don't affect local state
   * - Rapid state changes: Firebase's internal debouncing prevents excessive updates
   * - Component unmount: Listener properly cleaned up
   *
   * Performance Considerations:
   * - Listener only active when user is authenticated
   * - Minimal data transfer (only changed fields)
   * - Automatic reconnection on network recovery
   */
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

  // localStorage persistence functions defined above with useCallback

  // Export user data to file using file-saver library
  function exportUserData(): void {
    if (!userData) {
      throw new Error('No user data to export');
    }

    // Validate and structure the export data
    const exportData = validateUserDataExport({
      allCrates: userData.allCrates,
      config: userData.config,
      exportedAt: new Date().toISOString(),
    });

    // Create blob and use file-saver to download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const filename = `crate-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;

    saveAs(blob, filename);
    logger.log('📁 User data exported successfully:', filename);
  }

  // Import user data from file with validation
  function importUserData(file: File): Promise<AppState> {
    return new Promise((resolve, reject) => {
      try {
        // Validate file first
        const validatedFile = validateFileUpload(file);

        const reader = new FileReader();
        reader.onload = e => {
          try {
            const rawData = JSON.parse((e.target as FileReader).result as string);

            // Use safe validation to get structured error handling
            const validationResult = safeValidateUserDataExport(rawData);
            if (!validationResult.success) {
              reject(new Error(`Invalid file format: ${validationResult.error}`));
              return;
            }

            // Extract the validated data
            const { allCrates, config } = validationResult.data;

            // Create the merged data structure
            const mergedData: AppState = {
              allCrates,
              config: {
                wins: config.wins,
                gpWins: config.gpWins,
              },
            };

            logger.log('📁 User data imported successfully:', {
              crates: allCrates.length,
              wins: config.wins,
              gpWins: config.gpWins,
            });

            resolve(mergedData);
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
    saveUserData: currentUser
      ? (data: AppState) => debouncedSaveUserData(currentUser.uid, data)
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
