import { useCallback } from 'react';
import { doc, setDoc, FirestoreError } from 'firebase/firestore';
import { db } from '../firebase';
import logger from '../utils/logger';

// Define the state interface
interface AppState {
  allCrates: string[];
  config: {
    wins: number;
    gpWins: number;
  };
}

interface UseDebouncedSaveOptions {
  setSyncStatus: (status: 'synced' | 'syncing' | 'pending' | 'error') => void;
  setIsOnline: (online: boolean) => void;
  queueAction: (type: string, payload: any) => void;
}

interface UseDebouncedSaveReturn {
  saveUserData: (userId: string, data: AppState, retryCount?: number) => Promise<boolean>;
}

/**
 * Custom hook for handling debounced data persistence to Firestore with retry logic.
 * Implements exponential backoff for network failures and queues actions for offline scenarios.
 *
 * @param options - Configuration options for sync status management and action queuing
 * @returns Object containing the save function
 */
export function useDebouncedSave({
  setSyncStatus,
  setIsOnline,
  queueAction,
}: UseDebouncedSaveOptions): UseDebouncedSaveReturn {
  /**
   * Enhanced save function with offline support and retry logic.
   * Attempts to save user data to Firestore with exponential backoff on failures.
   * Automatically queues operations when offline or when quota is exceeded.
   *
   * @param userId - The user's unique identifier
   * @param data - Application state data to save
   * @param retryCount - Current retry attempt (used internally for recursion)
   * @returns Promise resolving to true if save was successful, false otherwise
   */
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
    [setSyncStatus, setIsOnline, queueAction]
  );

  return {
    saveUserData,
  };
}
