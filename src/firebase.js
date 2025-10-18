import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableNetwork, disableNetwork, clearIndexedDbPersistence } from "firebase/firestore";

import { GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate that all required environment variables are present
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !import.meta.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

// Configure Firestore offline persistence
let persistenceEnabled = false;

export async function enableOfflinePersistence() {
  if (persistenceEnabled) return;

  try {
    // Disable Firestore's built-in offline persistence
    // We're using our own localStorage system instead
    await disableNetwork(db);
    persistenceEnabled = true;
    console.log('Firestore offline persistence disabled - using custom localStorage system');
  } catch (error) {
    console.log('Firestore persistence handling:', error.message);
  }
}

export async function checkNetworkStatus() {
  try {
    // Try to enable network - if it fails, we're offline
    await enableNetwork(db);
    return true;
  } catch (error) {
    console.warn('Network check failed:', error.message);
    return false;
  }
}

export async function forceOfflineMode() {
  try {
    await disableNetwork(db);
    console.log('🔌 Forced offline mode - disabled Firestore network');
    return true;
  } catch (error) {
    console.error('❌ Failed to disable network:', error);
    return false;
  }
}

export async function clearPersistence() {
  try {
    await clearIndexedDbPersistence(db);
    persistenceEnabled = false;
    console.log('Firestore persistence cleared');
  } catch (error) {
    console.error('Failed to clear persistence:', error);
  }
}

// Initialize offline persistence when module loads
enableOfflinePersistence();

// Global error handler for Firebase errors - comprehensive approach
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

console.error = (...args) => {
  if (args[1] && typeof args[1] === 'string' && (
    args[1].includes('FirebaseError') ||
    args[0].includes('@firebase/firestore') ||
    args[1].includes('Quota exceeded') ||
    args[1].includes('resource-exhausted') ||
    args[1].includes('net::ERR_BLOCKED_BY_CLIENT') ||
    args[1].includes('channel?VER=8')
  )) {
    console.log('🚨 Global Firebase error handler caught:', ...args);

    // If it's a quota error or blocked request, treat as offline scenario
    if (args[1].includes('resource-exhausted') ||
        args[1].includes('Quota exceeded') ||
        args[1].includes('net::ERR_BLOCKED_BY_CLIENT') ||
        args[1].includes('channel?VER=8')) {
      console.log('🚨 Firebase operation blocked or failed - switching to offline mode');
      // Dispatch custom event to notify the app
      const event = new CustomEvent('firebase-operation-blocked', {
        detail: { error: args[1], timestamp: new Date().toISOString(), type: 'blocked' }
      });
      console.log('🚨 Dispatching blocked operation event:', event);
      window.dispatchEvent(event);
    }
  }
  originalError.apply(console, args);
};

console.warn = (...args) => {
  // Also catch Firebase warnings
  if (args[0] && typeof args[0] === 'string' && (
    args[0].includes('@firebase/firestore') ||
    args[0].includes('Firestore')
  )) {
    console.log('🚨 Global Firebase warning caught:', ...args);
  }
  originalWarn.apply(console, args);
};

// Add global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.log('🚨 Unhandled promise rejection:', event.reason);
  if (event.reason && (
    event.reason.code === 'resource-exhausted' ||
    event.reason.message?.includes('Quota exceeded')
  )) {
    console.log('🚨 Quota exceeded error caught globally');
    window.dispatchEvent(new CustomEvent('firebase-quota-exceeded'));
  }
});

// Listen for quota exceeded events
window.addEventListener('firebase-quota-exceeded', () => {
  console.log('🚨 Broadcasting quota exceeded event to app');
});
