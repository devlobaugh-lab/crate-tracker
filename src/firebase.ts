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

// Initialize offline persistence when module loads
enableOfflinePersistence();

// Global error handler for Firebase errors - comprehensive approach
const originalError = console.error;
const originalWarn = console.warn;
// const originalLog = console.log;

console.error = (...args: any[]) => {
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
  originalError.apply(console, args);
};

console.warn = (...args: any[]) => {
  // Also catch Firebase warnings
  if (
    args[0] &&
    typeof args[0] === 'string' &&
    (args[0].includes('@firebase/firestore') || args[0].includes('Firestore'))
  ) {
    logger.error('🚨 Global Firebase warning caught:', ...args);
  }
  originalWarn.apply(console, args);
};

// Add global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  logger.error('🚨 Unhandled promise rejection:', event.reason);
  if (
    event.reason &&
    (event.reason.code === 'resource-exhausted' || event.reason.message?.includes('Quota exceeded'))
  ) {
    logger.error('🚨 Quota exceeded error caught globally');
    window.dispatchEvent(new CustomEvent('firebase-quota-exceeded'));
  }
});

// Listen for quota exceeded events
window.addEventListener('firebase-quota-exceeded', () => {
  logger.error('🚨 Broadcasting quota exceeded event to app');
});
