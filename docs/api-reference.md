# API Reference

Internal TypeScript interfaces, custom hooks, and utility functions.

---

## Data Types

### `UserData`

The primary data structure for a user's tracked state. Stored in Firestore and localStorage.

```typescript
interface UserData {
  allCrates: string[];   // ordered history of crate type codes
  config: {
    wins: number;        // total win count
    gpWins: number;      // GP (blue crate) win count
  };
}
```

### `AuthorizedUser`

A user entry in the `authorizedUsers` Firestore collection.

```typescript
interface AuthorizedUser {
  id?: string;                       // document ID (matches email)
  email: string;                     // lowercase Gmail address
  role: 'admin' | 'normal';
  status: 'active' | 'inactive';
  invitedBy?: string;                // Gmail of the admin who added them
  invitedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `User`

The authenticated user object exposed through `AuthContext`.

```typescript
interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'admin' | 'normal';
  authorized?: boolean;
}
```

### Crate value constants

```typescript
// Single-character codes used in allCrates arrays
'B'  // Green (standard)
'G'  // Gold
'P'  // Platinum
'L'  // Legendary
'X'  // GP (Grand Prix / blue)
'?'  // Unknown / ambiguous
```

---

## Hooks

### `useAuth()`

Returns the full auth and data management context. Must be called inside `AuthProvider`.

```typescript
interface AuthContextType {
  // Auth state
  currentUser: User | null;
  isAuthorized: boolean;
  isAdmin: boolean;
  isLoading: boolean;

  // Sync state
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'pending' | 'error';

  // Data
  userData: UserData | null;
  saveUserData: (data: UserData) => Promise<boolean>;

  // Offline
  saveOfflineData: (data: UserData) => void;
  loadOfflineData: () => UserData | null;
  clearOfflineData: () => void;

  // Actions
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

### `useAppState(options)`

Manages core application state with offline/online sync.

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

interface UseAppStateReturn {
  state: UserData;
  setState: React.Dispatch<React.SetStateAction<UserData>>;
  isInitialized: boolean;
}
```

### `useCrateManagement(options)`

Exposes the three mutation operations.

```typescript
interface UseCrateManagementOptions {
  state: UserData;
  setState: React.Dispatch<React.SetStateAction<UserData>>;
  setIgnoreRemoteChanges: (ignore: boolean) => void;
}

interface UseCrateManagementReturn {
  addCrate: (crateValue: string) => void;
  undoCrate: () => void;
  fastForwardSubmit: (additionalGP: number, newTotal: number) => void;
}
```

**`addCrate(crateValue)`**
Appends the crate value to history, increments `wins`, and increments `gpWins` if the value is `'X'`.

**`undoCrate()`**
Removes the last crate from history and reverses the win counter adjustment.

**`fastForwardSubmit(additionalGP, newTotal)`**
Adds `additionalGP` GP crates, then fills the remaining gap to `newTotal` using the prediction algorithm. Sets `ignoreRemoteChanges` for 10 seconds.

### `useCratePattern(crateHistory)`

Derives display data and predictions from the current crate history.

```typescript
function useCratePattern(crateHistory: string[]): {
  lastTen: string[];
  futureTen: string[];
  nextSpecialCrate: {
    count?: number;    // crates until next Platinum or Legendary (if certain)
    type: string;      // 'Platinum', 'Legendary', 'Not sure', or 'No data'
  };
}
```

---

## Utility Functions

### Pattern utilities (`src/utils/patternUtils.ts`)

**`nextPatternValues(userInput, masterPattern)`**

Returns the next 10 predicted crate values based on current history. Returns `'?'` for any position where the prediction is ambiguous.

```typescript
function nextPatternValues(
  userInput: string[],
  masterPattern: string
): string[]
```

**`findNextSpecialCrateExtended(userInput, masterPattern)`**

Scans up to 100 positions ahead and returns the first certain Platinum or Legendary crate.

```typescript
function findNextSpecialCrateExtended(
  userInput: string[],
  masterPattern: string
): { count: number; type: 'Platinum' | 'Legendary' } | null
```

### Authorization (`src/utils/authorization.ts`)

**`isAdmin(user)`**

Returns `true` if the user has `role: 'admin'` in the `authorizedUsers` collection.

### Validation (`src/utils/validation.ts`)

Zod schemas used for import validation and data integrity.

```typescript
// Validates a JSON backup file on import
const userDataSchema: ZodSchema<UserData>

// Validates Gmail addresses (lowercase, no aliases)
const gmailSchema: ZodSchema<string>
```

### Logger (`src/utils/logger.ts`)

```typescript
logger.debug(message, ...args)
logger.info(message, ...args)
logger.warn(message, ...args)
logger.error(message, ...args)
```

### Notifications (`src/utils/notifications.ts`)

Thin wrappers around `react-hot-toast`:

```typescript
notify.success(message: string): void
notify.error(message: string): void
notify.loading(message: string): string  // returns toast ID
notify.dismiss(id: string): void
```

---

## Constants (`src/utils/constants.ts`)

```typescript
MASTER_PATTERN: string        // 810-character crate pattern string
STORAGE_KEY: string           // localStorage key ('crate-tracker:v1')
DEBOUNCE_DELAY: number        // Firestore write debounce in ms (500)
IGNORE_REMOTE_TIMEOUT: number // Fast-forward conflict window in ms (10000)
PREDICTION_COUNT: number      // Predictions to generate (10)
SPECIAL_CRATE_LOOKAHEAD: number // Max lookahead for special crates (100)
```

---

## Component Props

### `CrateGrid`

```typescript
interface CrateGridProps {
  onCrateSelect: (crateValue: string) => void;
  onUndo: () => void;
  onFastForward: () => void;
}
```

### `ConfigView`

```typescript
interface ConfigViewProps {
  config: UserData['config'];
  allCrates: string[];
  onChange: (config: UserData['config'], resetData?: boolean, importData?: UserData) => void;
  onBack: () => void;
  onAdmin: () => void;
  setIgnoreRemoteChanges: (ignore: boolean) => void;
}
```

### `SmallRow`

```typescript
interface SmallRowProps {
  crates: string[];   // array of crate value codes to display
}
```

### `FastForward`

```typescript
interface FastForwardProps {
  currentWins: number;
  currentGpWins: number;
  onSubmit: (additionalGP: number, newTotal: number) => void;
  onClose: () => void;
}
```

---

## Firestore Events

The app dispatches custom window events for Firebase lifecycle issues:

```typescript
// Fired when a Firebase operation is blocked (e.g. COOP policy)
'firebase-operation-blocked'

// Fired when Firestore quota is exceeded
'firebase-quota-exceeded'
```

Event detail shape:

```typescript
interface FirebaseEventDetail {
  type: 'blocked' | 'quota-exceeded' | 'sync-success' | 'sync-failure';
  error?: string;
  timestamp: string;
}
```
