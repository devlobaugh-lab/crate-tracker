# Crate Tracker API Reference

## Overview

This document provides a comprehensive reference for the Crate Tracker application's internal APIs, data structures, and interfaces. Since this is a frontend application, the "API" refers to internal TypeScript interfaces, custom hooks, and service functions rather than RESTful endpoints.

## Core Interfaces

### User Management

#### User Interface
```typescript
interface User {
  uid: string;              // Firebase Auth user ID
  email: string;            // Gmail address (lowercased)
  displayName?: string;     // Display name from Google OAuth
  photoURL?: string;        // Profile photo URL
  role?: 'admin' | 'normal'; // User role (admin/users collections)
  authorized?: boolean;     // Whether user is in whitelist
}
```

#### AuthorizedUser Interface
```typescript
interface AuthorizedUser {
  id?: string;              // Document ID (matches Gmail)
  email: string;            // Gmail address (lowercased)
  role: 'admin' | 'normal'; // User permissions
  status: 'active' | 'inactive'; // Account status
  invitedBy?: string;       // Gmail of inviting admin
  invitedAt?: Timestamp;    // Firebase Timestamp
  createdAt: Timestamp;     // Creation timestamp
  updatedAt: Timestamp;     // Last update timestamp
}
```

### Data Models

#### UserData Interface
Primary data structure for user crate tracking:

```typescript
interface UserData {
  allCrates: string[];      // Array of crate colors won
  config: {
    wins: number;           // Total game wins (determines crate distribution)
    gpWins: number;         // Grand Prix wins (for pattern analysis)
  };
}
```

#### Crate Interface
Individual crate entry structure:

```typescript
interface Crate {
  id: string;               // Unique identifier
  name: string;            // Crate color/type
  description?: string;    // Optional description
  color?: string;          // Hex color code
  createdAt: Date;         // Creation timestamp
  updatedAt: Date;         // Last modification
  userId: string;          // Owning user ID
}
```

## Custom Hooks

### useAppState Hook

Manages application state with offline/online synchronization.

#### Signature
```typescript
function useAppState(options: UseAppStateOptions): UseAppStateReturn
```

#### Parameters
```typescript
interface UseAppStateOptions {
  currentUser: User | null;
  userData: UserData | null;
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'pending' | 'error';
  saveUserData: (data: UserData) => Promise<boolean>;
  saveOfflineData: (data: UserData) => void;
  loadOfflineData: () => UserData | null;
  clearOfflineData: () => void;
  ignoreRemoteChanges: boolean;
}
```

#### Returns
```typescript
interface UseAppStateReturn {
  state: UserData;          // Current application state
  setState: (state: UserData | ((prev: UserData) => UserData)) => void;
  isInitialized: boolean;   // Whether state has been initialized
}
```

#### Usage Example
```typescript
const { state, setState } = useAppState({
  currentUser,
  userData,
  isOnline: true,
  syncStatus: 'synced',
  saveUserData,
  // ... other options
});

// Update crate list
setState(prev => ({
  ...prev,
  allCrates: [...prev.allCrates, 'blue']
}));
```

### useCrateManagement Hook

Handles crate addition, undo, and fast-forward operations.

#### Signature
```typescript
function useCrateManagement(options: UseCrateManagementOptions): UseCrateManagementReturn
```

#### Parameters
```typescript
interface UseCrateManagementOptions {
  state: UserData;
  setState: (state: UserData | ((prev: UserData) => UserData)) => void;
  setIgnoreRemoteChanges: (ignore: boolean) => void;
}
```

#### Returns
```typescript
interface UseCrateManagementReturn {
  addCrate: (crateColor: string) => void;
  undoCrate: () => void;
  fastForwardSubmit: (additionalGP: number, newTotal: number) => void;
}
```

#### Usage Example
```typescript
const { addCrate, undoCrate } = useCrateManagement({
  state,
  setState,
  setIgnoreRemoteChanges
});

// Add a crate
addCrate('blue');

// Undo last crate
undoCrate();
```

### useCratePattern Hook

Calculates crate patterns and predictions algorithm.

#### Signature
```typescript
function useCratePattern(crateHistory: string[]): UseCratePatternReturn
```

#### Returns
```typescript
interface UseCratePatternReturn {
  lastTen: string[];        // Last 10 crates for display
  futureTen: string[];      // Next 10 predicted crates
  nextSpecialCrate: {       // Special crate prediction
    count?: number;         // How many crates until special
    type: string;          // 'Platinum', 'Legendary', 'Not sure', or 'No data'
  };
}
```

#### Usage Example
```typescript
const { lastTen, futureTen, nextSpecialCrate } = useCratePattern(allCrates);

console.log(`Next ${nextSpecialCrate.count} crates until ${nextSpecialCrate.type}`);
```

## Service Functions

### Firebase Services

#### Authentication Functions
```typescript
// Sign in with Google OAuth
function signInWithGoogle(): Promise<UserCredential>;

// Sign out current user
function signOut(): Promise<void>;

// Get current authenticated user
function getCurrentUser(): User | null;
```

#### Firestore Operations
```typescript
// Save user data to Firestore
function saveUserData(userId: string, data: UserData): Promise<void>;

// Load user data from Firestore
function loadUserData(userId: string): Promise<UserData | null>;

// Check if user is authorized
function checkUserAuthorization(email: string): Promise<boolean>;
```

### Offline Storage Services

#### Local Storage Operations
```typescript
// Save data to localStorage
function saveOfflineData(data: UserData): void;

// Load data from localStorage
function loadOfflineData(): UserData | null;

// Clear offline data
function clearOfflineData(): void;

// Check if offline data exists
function hasOfflineData(): boolean;
```

### Sync Management

#### Synchronization Functions
```typescript
// Force synchronization
function forceSync(): Promise<void>;

// Check network status
function isOnline(): Promise<boolean>;

// Enable offline mode
function enableOfflineMode(): Promise<void>;

// Disable offline mode
function disableOfflineMode(): Promise<void>;
```

## Utility Functions

### Pattern Analysis

#### Core Pattern Functions
```typescript
// Analyze crate patterns from history
function analyzePatterns(crateHistory: string[]): PatternData;

// Calculate prediction weights
function calculateWeights(patterns: PatternData, winCount: number): WeightedPatterns;

// Generate next crate predictions
function generatePredictions(weights: WeightedPatterns, count: number): string[];

// Find next special crate
function findNextSpecialCrate(predictions: string[]): SpecialCrateInfo;
```

#### Pattern Data Types
```typescript
interface PatternData {
  frequencies: Record<string, number>;     // Color frequencies
  sequences: string[];                    // Recent sequences
  transitions: Record<string, Record<string, number>>; // State transitions
}

interface WeightedPatterns {
  probabilities: Record<string, number>;  // Weighted probabilities
  recency: number;                        // Recency factor
  total: number;                          // Sum of weights
}

interface SpecialCrateInfo {
  type: 'Platinum' | 'Legendary' | 'Not sure' | 'No data';
  count?: number;                         // Crates until special (if known)
}
```

### Validation Utilities

#### Input Validation
```typescript
// Validate Gmail address format
function isValidGmailAddress(email: string): boolean;

// Validate user input
function validateUserInput(input: any): ValidationResult;

// Sanitize crate color
function sanitizeCrateColor(color: string): string;

// Validate configuration
function validateConfig(config: UserConfig): ConfigValidationResult;
```

#### Validation Types
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

interface ConfigValidationResult extends ValidationResult {
  sanitizedConfig?: UserConfig;
}
```

### Logger Utilities

#### Logging Functions
```typescript
// Log debug information
function debug(message: string, ...args: any[]): void;

// Log general information
function info(message: string, ...args: any[]): void;

// Log warnings
function warn(message: string, ...args: any[]): void;

// Log errors
function error(message: string, ...args: any[]): void;
```

#### Logger Configuration
```typescript
// Configure logger level
function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;

// Enable/disable console output
function setConsoleOutput(enabled: boolean): void;

// Get logger instance
function getLogger(namespace: string): Logger;
```

## Component Props

### Core Components

#### App Component
```typescript
interface AppProps {
  // No props - uses context for all dependencies
}
```

#### AuthContext Props
```typescript
interface AuthProviderProps {
  children: React.ReactNode;
}
```

#### CrateGrid Props
```typescript
interface CrateGridProps {
  onCrateSelect: (crateColor: string) => void;
  onUndo: () => void;
  onFastForward: () => void;
  disabled?: boolean;
}
```

#### ConfigView Props
```typescript
interface ConfigViewProps {
  config: UserConfig;
  allCrates: string[];
  onChange: (config: UserConfig, resetData?: boolean, importData?: UserData) => void;
  onBack: () => void;
  onAdmin: () => void;
  setIgnoreRemoteChanges: (ignore: boolean) => void;
}
```

#### SmallRow Props
```typescript
interface SmallRowProps {
  crates: string[];         // Array of crate colors
  size?: 'small' | 'medium' | 'large';
  showLabels?: boolean;
}
```

## Constants and Enums

### Crate Colors
```typescript
enum CrateColor {
  BLUE = 'blue',
  PURPLE = 'purple',
  PINK = 'pink',
  RED = 'red',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  LEGENDARY = 'legendary'
}
```

### Special Crates
```typescript
const SPECIAL_CRATES = ['platinum', 'legendary'] as const;
type SpecialCrate = typeof SPECIAL_CRATES[number];
```

### App Constants
```typescript
const APP_VERSION = '1.3.7';
const PREDICTION_COUNT = 10;
const LAST_CRATE_COUNT = 10;
const DEBOUNCE_DELAY = 500; // milliseconds
const OFFLINE_IGNORE_TIMEOUT = 5000; // milliseconds
```

## Error Types

### Custom Errors
```typescript
class FirebaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  );

  // Example:
  // throw new FirebaseError('Document not found', 'not-found');
}

class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  );

  // Example:
  // throw new ValidationError('Invalid crate color', 'crateColor', 'invalid');
}

class SyncError extends Error {
  constructor(message: string, public syncType: 'push' | 'pull' | 'conflict');

  // Example:
  // throw new SyncError('Network error during sync', 'push');
}
```

## Events and Callbacks

### Event Types
```typescript
interface FirebaseEventDetail {
  type: 'blocked' | 'quota-exceeded' | 'sync-success' | 'sync-failure';
  error?: string;
  timestamp: string;
}

// Custom events dispatched on window
const EVENT_NAMES = {
  FIREBASE_OPERATION_BLOCKED: 'firebase-operation-blocked',
  FIREBASE_QUOTA_EXCEEDED: 'firebase-quota-exceeded',
  SYNC_STATUS_CHANGED: 'sync-status-changed',
} as const;
```

### Callback Signatures
```typescript
// Crate selection callback
type CrateSelectHandler = (crateColor: string) => void;

// State update callback
type StateUpdateHandler = (newState: UserData) => void;

// Error callback
type ErrorHandler = (error: Error, context?: any) => void;

// Sync callback
type SyncCompleteHandler = (success: boolean, error?: Error) => void;
```

## Performance Metrics

### Application Metrics
```typescript
interface AppPerformanceMetrics {
  // Initialization time
  initializationTime: number;

  // Sync performance
  syncTimes: number[];      // Array of sync durations
  syncFailures: number;     // Failed sync attempts

  // Operation counts
  crateAdds: number;
  crateUndos: number;
  fastForwards: number;

  // Memory usage
  peakMemoryUsage: number;
  averageMemoryUsage: number;

  // Network statistics
  bytesUploaded: number;
  bytesDownloaded: number;
  networkRequests: number;
}
```

This API reference provides comprehensive documentation of the Crate Tracker application's internal interfaces and patterns. Use this reference when developing new features, debugging issues, or integrating with existing components.
