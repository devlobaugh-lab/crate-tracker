// Core application types
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'admin' | 'normal';
  authorized?: boolean;
}

// Import Firebase types
import { Timestamp, FieldValue } from 'firebase/firestore';

// User authorization and management types
export interface AuthorizedUser {
  id?: string; // Document ID
  email: string; // lowercased Gmail address
  role: 'admin' | 'normal';
  status: 'active' | 'inactive';
  invitedBy?: string; // Gmail of inviting admin
  invitedAt?: Timestamp | FieldValue;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export interface UserInvitation {
  email: string;
  role: 'admin' | 'normal';
  invitedBy: string; // Admin Gmail address
}

export interface Crate {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

// Focused interfaces for AuthContextType refactoring
export interface AuthenticationType {
  currentUser: User | null;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  authLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  authorizationStatus: 'checking' | 'authorized' | 'unauthorized';
}

export interface DataManagementType {
  userData: any;
  saveUserData: (data: any) => Promise<boolean>;
  loadUserData: () => any;
  setIgnoreRemoteChanges: (ignore: boolean) => void;
  exportUserData: () => void;
  importUserData: (file: File) => Promise<any>;
}

export interface SyncManagementType {
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'pending' | 'error';
  actionQueue: any[];
  processActionQueue: () => Promise<void>;
  queueAction: (type: string, payload: any) => void;
  saveOfflineData: (data: any) => void;
  loadOfflineData: () => any;
  clearOfflineData: () => void;
}

// Combined interface for backward compatibility
export interface AuthContextType
  extends AuthenticationType,
    DataManagementType,
    SyncManagementType {}

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
