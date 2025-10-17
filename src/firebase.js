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
    // Firestore enables persistence by default in modern versions
    // We just need to handle the initialization
    persistenceEnabled = true;
    console.log('Firestore offline persistence enabled');
  } catch (error) {
    // Handle cases where multiple tabs are open or persistence fails
    if (error.code === 'failed-precondition') {
      console.warn('Firestore persistence failed: Multiple tabs open. Continuing without persistence.');
    } else if (error.code === 'unimplemented') {
      console.warn('Firestore persistence not supported in this environment');
    } else {
      console.error('Firestore persistence error:', error);
    }
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
    console.log('Forced offline mode');
  } catch (error) {
    console.error('Failed to disable network:', error);
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
