// Core application types
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface Crate {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

export interface AuthContextType {
  currentUser: User | null;
  login: () => Promise<any>; // Google sign in returns Firebase User
  register: () => Promise<any>; // Google sign in returns Firebase User
  logout: () => Promise<void>;
  loading: boolean;
  // Extended properties for the app
  userData: any;
  saveUserData: (data: any) => Promise<boolean>;
  loadUserData: () => any;
  setIgnoreRemoteChanges: (ignore: boolean) => void;
  exportUserData: () => void;
  importUserData: (file: File) => Promise<any>;
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'pending' | 'error';
  actionQueue: any[];
  processActionQueue: () => Promise<void>;
  queueAction: (type: string, payload: any) => void;
  saveOfflineData: (data: any) => void;
  loadOfflineData: () => any;
  clearOfflineData: () => void;
  // Auth specific properties
  signInWithGoogle: () => Promise<any>;
  authLoading: boolean;
}

// Firebase types
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Component prop types
export interface LoginProps {
  onLogin?: (user: User) => void;
}

export interface UserProfileProps {
  user: User;
  onLogout?: () => void;
}

// Hook return types
export interface UseCratePatternReturn {
  crates: Crate[];
  loading: boolean;
  error: string | null;
  addCrate: (crate: Omit<Crate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCrate: (id: string, updates: Partial<Crate>) => Promise<void>;
  deleteCrate: (id: string) => Promise<void>;
}

// Environment variables interface
export interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

export interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Utility types
export type ViewMode = 'grid' | 'list';
export type SortOrder = 'asc' | 'desc';
export type FilterType = 'all' | 'active' | 'completed';
