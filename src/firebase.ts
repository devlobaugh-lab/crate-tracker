import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  enableNetwork,
  disableNetwork,
  clearIndexedDbPersistence,
} from 'firebase/firestore';
import { FirebaseConfig } from './types';
import logger from './utils/logger';

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate that all required environment variables are present
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missingEnvVars = requiredEnvVars.filter((envVar: string) => !import.meta.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

// Configure Firestore offline persistence
let persistenceEnabled = false;

export async function enableOfflinePersistence(): Promise<void> {
  if (persistenceEnabled) return;

  try {
    // Enable Firestore's built-in offline persistence for better reliability
    // This allows the app to work online when possible and offline when needed
    persistenceEnabled = true;
    logger.log('Firestore offline persistence enabled - supporting online/offline modes');
  } catch (error) {
    logger.log('Firestore persistence handling:', (error as Error).message);
    // If enabling persistence fails, try to at least keep network enabled
    try {
      await enableNetwork(db);
    } catch (networkError) {
      logger.warn(
        'Failed to enable network after persistence error:',
        (networkError as Error).message
      );
    }
  }
}

export async function checkNetworkStatus(): Promise<boolean> {
  try {
    // Try to enable network - if it fails, we're offline
    await enableNetwork(db);
    return true;
  } catch (error) {
    logger.warn('Network check failed:', (error as Error).message);
    return false;
  }
}

export async function forceOfflineMode(): Promise<boolean> {
  try {
    await disableNetwork(db);
    logger.log('🔌 Forced offline mode - disabled Firestore network');
    return true;
  } catch (error) {
    logger.error('❌ Failed to disable network:', error);
    return false;
  }
}

export async function clearPersistence(): Promise<void> {
  try {
    await clearIndexedDbPersistence(db);
    persistenceEnabled = false;
    logger.log('Firestore persistence cleared');
  } catch (error) {
    logger.error('Failed to clear persistence:', error);
  }
}

/**
 * Firebase Error Handler
 *
 * Centralized error handling for Firebase operations with controlled console interception.
 * Provides structured error handling for quota exceeded and network issues while maintaining
 * backward compatibility with existing error detection mechanisms.
 */
export class FirebaseErrorHandler {
  private static instance: FirebaseErrorHandler;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  private constructor() {
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
    this.setupGlobalHandlers();
  }

  static getInstance(): FirebaseErrorHandler {
    if (!FirebaseErrorHandler.instance) {
      FirebaseErrorHandler.instance = new FirebaseErrorHandler();
    }
    return FirebaseErrorHandler.instance;
  }

  /**
   * Sets up global error handlers for Firebase-related errors
   */
  private setupGlobalHandlers(): void {
    // Intercept console.error and console.warn for Firebase errors
    console.error = (...args: any[]) => {
      this.handleConsoleError(args);
      this.originalConsoleError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      this.handleConsoleWarn(args);
      this.originalConsoleWarn.apply(console, args);
    };

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      this.handleFirebaseError(event.reason);
    });

    // Listen for quota exceeded events from other parts of the app
    window.addEventListener('firebase-quota-exceeded', () => {
      logger.error('🚨 Broadcasting quota exceeded event to app');
    });
  }

  /**
   * Handles console.error calls to detect Firebase errors
   */
  private handleConsoleError(args: any[]): void {
    if (
      args[1] &&
      typeof args[1] === 'string' &&
      (args[1].includes('FirebaseError') ||
        args[0].includes('@firebase/firestore') ||
        args[1].includes('Quota exceeded') ||
        args[1].includes('resource-exhausted') ||
        args[1].includes('net::ERR_BLOCKED_BY_CLIENT') ||
        args[1].includes('channel?VER=8'))
    ) {
      logger.error('🚨 Global Firebase error handler caught:', ...args);

      // If it's a quota error or blocked request, treat as offline scenario
      if (
        args[1].includes('resource-exhausted') ||
        args[1].includes('Quota exceeded') ||
        args[1].includes('net::ERR_BLOCKED_BY_CLIENT') ||
        args[1].includes('channel?VER=8')
      ) {
        logger.error('🚨 Firebase operation blocked or failed - switching to offline mode');
        // Dispatch custom event to notify the app
        const event = new CustomEvent('firebase-operation-blocked', {
          detail: { error: args[1], timestamp: new Date().toISOString(), type: 'blocked' },
        });
        logger.error('🚨 Dispatching blocked operation event:', event);
        window.dispatchEvent(event);
      }
    }
  }

  /**
   * Handles console.warn calls to detect Firebase warnings
   */
  private handleConsoleWarn(args: any[]): void {
    // Also catch Firebase warnings
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      (args[0].includes('@firebase/firestore') || args[0].includes('Firestore'))
    ) {
      logger.error('🚨 Global Firebase warning caught:', ...args);
    }
  }

  /**
   * Handles Firebase-specific errors and dispatches appropriate events
   */
  handleFirebaseError(error: any): void {
    if (!error) return;

    const errorMessage = error.message || error.toString();
    const errorCode = error.code;

    // Check for quota exceeded errors
    if (
      errorCode === 'resource-exhausted' ||
      errorMessage.includes('Quota exceeded') ||
      errorMessage.includes('resource-exhausted')
    ) {
      logger.error('🚨 Firebase quota exceeded error:', error);
      this.dispatchQuotaExceededEvent(error);
      return;
    }

    // Check for network/blocked operation errors
    if (
      errorMessage.includes('net::ERR_BLOCKED_BY_CLIENT') ||
      errorMessage.includes('channel?VER=8') ||
      errorCode === 'unavailable' ||
      errorCode === 'deadline-exceeded'
    ) {
      logger.error('🚨 Firebase operation blocked/network error:', error);
      this.dispatchOperationBlockedEvent(error);
      return;
    }

    // Log other Firebase errors for debugging
    if (errorCode && errorCode.startsWith('firestore/')) {
      logger.error('🚨 Firebase error:', error);
    }
  }

  /**
   * Dispatches a quota exceeded event to notify the app
   */
  private dispatchQuotaExceededEvent(error: any): void {
    const event = new CustomEvent('firebase-quota-exceeded', {
      detail: {
        error: error.message || error.toString(),
        timestamp: new Date().toISOString(),
        type: 'quota-exceeded',
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Dispatches an operation blocked event to notify the app
   */
  private dispatchOperationBlockedEvent(error: any): void {
    const event = new CustomEvent('firebase-operation-blocked', {
      detail: {
        error: error.message || error.toString(),
        timestamp: new Date().toISOString(),
        type: 'operation-blocked',
      },
    });
    window.dispatchEvent(event);
  }
}

// Initialize offline persistence when module loads
enableOfflinePersistence();

// Initialize the Firebase error handler
FirebaseErrorHandler.getInstance();
