# Crate Tracker Engineering Documentation

## Technical Implementation

This document provides detailed technical information about the Crate Tracker application's implementation, codebase structure, and development practices.

## Project Structure

```
crate-tracker-vite/
├── src/
│   ├── components/
│   │   ├── common/          # Reusable UI components
│   │   │   ├── ConnectionStatus.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── SmallRow.tsx
│   │   │   └── UnauthorizedAccess.tsx
│   │   ├── crate/
│   │   │   └── CrateGrid.tsx
│   │   └── views/
│   │       ├── AdminView.tsx
│   │       ├── ConfigView.tsx
│   │       ├── FastForward.tsx
│   │       └── IntroView.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useAppState.ts
│   │   ├── useCrateManagement.ts
│   │   ├── useCratePattern.ts
│   │   ├── useDebouncedSave.ts
│   │   ├── useIgnoreRemoteChanges.ts
│   │   └── useSyncManager.ts
│   ├── types/               # TypeScript definitions
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── authorization.ts
│   │   ├── constants.ts
│   │   ├── gmail-validation.test.ts
│   │   ├── logger.ts
│   │   ├── notifications.ts
│   │   ├── patternUtils.ts
│   │   └── validation.ts
│   ├── App.tsx              # Main application component
│   ├── AuthContext.tsx      # Authentication context provider
│   ├── firebase.ts          # Firebase configuration and utilities
│   ├── main.tsx             # Application entry point
│   ├── Login.tsx            # Authentication component
│   └── UserProfile.tsx      # User profile display
├── functions/               # Firebase Cloud Functions (future)
├── public/                  # Static assets
├── docs/                    # Documentation
├── .env.example             # Environment variables template
├── eslint.config.js         # ESLint configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── vite.config.js          # Vite build configuration
├── tsconfig.json           # TypeScript configuration
├── firebase.json           # Firebase project configuration
├── firestore.rules         # Firestore security rules
└── Dockerfile              # Container deployment configuration
```

## Core Implementation

### State Management Architecture

#### Custom Hooks Pattern

The application uses a custom hooks pattern for state management, providing clean separation of concerns and reusability:

```typescript
// Example: useAppState hook
export function useAppState(options: UseAppStateOptions): UseAppStateReturn {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, setState] = useState<AppState>(() => {
    // Complex initialization logic prioritizing offline data
    return initializeState(options);
  });

  // Debounced save effect
  useEffect(() => {
    if (state && currentUser && isOnline && syncStatus !== 'error') {
      const timeout = setTimeout(() => {
        saveUserData(state);
      }, 500);
      saveTimeoutRef.current = timeout;
    }
  }, [state, saveUserData, currentUser, isOnline, syncStatus]);

  return { state, setState, isInitialized };
}
```

#### Context Provider Pattern

Authentication and global state are managed through React Context:

```typescript
// AuthContext combines multiple concerns
interface AuthContextType extends
  AuthenticationType,
  DataManagementType,
  SyncManagementType {}

// Provider implementation with error boundaries
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Authentication logic
  // Data management logic
  // Sync management logic

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

### Error Handling Strategy

#### Error Boundary Components

The application implements multiple error boundaries at different levels:

```typescript
// Component-level error boundary
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

#### Custom Error Types

Domain-specific error handling:

```typescript
export class FirebaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'FirebaseError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### Firebase Integration

#### Authentication Setup

```typescript
const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ... other config
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
```

#### Real-time Data Synchronization

```typescript
export function useFirebaseSync(userId: string) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (doc) => {
        setData(doc.data());
        setLoading(false);
      },
      (error) => {
        logger.error('Sync error:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [userId]);

  return { data, loading };
}
```

### Prediction Algorithm

The crate prediction algorithm analyzes historical data to predict future crate patterns:

```typescript
// Core prediction logic
export function predictNextCrates(
  crateHistory: string[],
  winCount: number
): PredictionResult {
  // Statistical analysis of patterns
  const patterns = analyzePatterns(crateHistory);

  // Weight calculations based on recency and frequency
  const weightedPatterns = calculateWeights(patterns, winCount);

  // Generate predictions
  const predictions = generatePredictions(weightedPatterns, 10);

  // Calculate special crate probability
  const specialCrateIndex = findNextSpecialCrate(predictions);

  return { predictions, specialCrateIndex };
}
```

### Testing Strategy

#### Unit Testing

Comprehensive unit tests cover utilities and hooks:

```typescript
// Example: Hook testing with React Testing Library
describe('useAppState', () => {
  it('initializes with correct default state', () => {
    const { result } = renderHook(() =>
      useAppState(mockOptions)
    );

    expect(result.current.state.allCrates).toEqual([]);
    expect(result.current.state.config.wins).toBe(0);
  });

  it('updates state correctly', () => {
    const { result } = renderHook(() =>
      useAppState(mockOptions)
    );

    act(() => {
      result.current.setState(prev => ({
        ...prev,
        allCrates: ['blue']
      }));
    });

    expect(result.current.state.allCrates).toEqual(['blue']);
  });
});
```

#### Integration Testing

End-to-end scenarios test complete user flows:

```typescript
describe('Crate Addition Flow', () => {
  it('adds crate and updates predictions', async () => {
    render(<App />);

    // Simulate user login
    fireEvent.click(screen.getByText('Sign In'));

    // Add a crate
    fireEvent.click(screen.getByTestId('blue-crate'));

    // Verify state changes
    await waitFor(() => {
      expect(screen.getByText('Wins: 1')).toBeInTheDocument();
    });

    // Check predictions updated
    expect(screen.getByTestId('predictions')).toBeInTheDocument();
  });
});
```

### Performance Optimization

#### Code Splitting and Lazy Loading

```typescript
// Dynamic imports for route-based code splitting
const AdminView = lazy(() =>
  import('./components/views/AdminView').then(module => ({
    default: module.AdminView
  }))
);

// Usage in main app
<Suspense fallback={<div>Loading...</div>}>
  <AdminView />
</Suspense>
```

#### Debounced Operations

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

#### Memory Management

```typescript
// Cleanup subscriptions and timers
useEffect(() => {
  const subscriptions = setupListeners();

  return () => {
    subscriptions.forEach(unsubscribe => unsubscribe());
  };
}, []);

// Memory leak prevention in custom hooks
function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []);
}
```

### Security Implementation

#### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions for authorization checks
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() &&
             exists(/databases/$(database)/documents/authorizedUsers/$(request.auth.token.email.lower())) &&
             get(/databases/$(database)/documents/authorizedUsers/$(request.auth.token.email.lower())).data.role == 'admin';
    }

    // Users collection - read/write only to own data
    match /users/{userId} {
      allow read, write: if isAuthorized() && isOwner(userId);
      allow create: if isAuthorized() && isAuthenticated() && request.auth.uid == userId;
    }

    // Authorized users collection - admin management only
    match /authorizedUsers/{gmailAddress} {
      allow read: if isAuthenticated() && (request.auth.token.email.lower() == gmailAddress || isAdmin());
      allow create, update, delete: if isAdmin();
    }
  }
}
```

#### Input Validation

```typescript
// Zod schemas for runtime validation
export const userDataSchema = z.object({
  allCrates: z.array(z.string()),
  config: z.object({
    wins: z.number().min(0),
    gpWins: z.number().min(0),
  }),
});

export const crateSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
  userId: z.string(),
});

// Validation usage
function addCrate(crate: CrateInput) {
  const validated = crateSchema.parse(crate);
  // Proceed with validated data
}
```

### Deployment and CI/CD

#### GitHub Actions Workflow

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test:run

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: crate-tracker-prod
```

#### Environment Configuration

```javascript
// vite.config.js - Environment-aware builds
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      __DEV__: mode === 'development',
    },
    plugins: [
      react(),
      // Environment-specific plugins
    ],
  };
});
```

### Monitoring and Observability

#### Error Tracking

```typescript
// Global error handler
window.addEventListener('error', (event) => {
  logger.error('Global error:', event.error);
  // Send to error reporting service
});

// Promise rejection tracking
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
  // Report to monitoring service
});
```

#### Performance Monitoring

```typescript
// Navigation timing
export function logPerformanceMetrics() {
  if ('performance' in window) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    logger.info('Performance metrics:', {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      domReady: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loaded: navigation.loadEventEnd - navigation.loadEventStart,
    });
  }
}

// React Profiler integration
<Profiler id="App" onRender={onRenderCallback}>
  <App />
</Profiler>
```

## Development Guidelines

### Code Style and Conventions

#### Naming Conventions
```typescript
// Components and hooks
function useUserData() {}        // use + PascalCase
function CrateGrid() {}          // PascalCase
const SmallRow = () => {};       // PascalCase

// Utilities and types
interface FirebaseConfig {}      // PascalCase
function calculatePatterns() {}  // camelCase
const APP_VERSION = '1.0.0';     // UPPER_SNAKE_CASE
```

#### Component Structure
```typescript
interface Props {
  userId: string;
  onSelect: (crateId: string) => void;
}

export const CrateGrid: React.FC<Props> = ({ userId, onSelect }) => {
  // Hooks at the top
  const { data, loading } = useCrateData(userId);

  // Early returns for loading/error states
  if (loading) return <div>Loading...</div>;

  // Handlers
  const handleSelect = useCallback((crateId: string) => {
    onSelect(crateId);
  }, [onSelect]);

  // Render
  return (
    <div className="crate-grid">
      {/* JSX content */}
    </div>
  );
};
```

### Git Workflow

#### Branch Strategy
- `main`: Production code
- `staging`: Integration branch for testing
- `feature/*`: Feature branches
- `hotfix/*`: Critical bug fixes

#### Commit Conventions
```bash
# Format: type(scope): description
git commit -m "feat(auth): add Google OAuth integration"
git commit -m "fix(predictions): correct special crate calculation"
git commit -m "refactor(components): extract crate grid logic to hook"
git commit -m "test(utils): add pattern analysis unit tests"
```

### Testing Best Practices

#### Unit Test Structure
```typescript
describe('useAppState', () => {
  describe('initialization', () => {
    it('should initialize with empty state', () => {
      // Test implementation
    });

    it('should load offline data when available', () => {
      // Test implementation
    });
  });

  describe('state updates', () => {
    it('should save to Firebase when online', async () => {
      // Test implementation
    });

    it('should save to localStorage when offline', () => {
      // Test implementation
    });
  });
});
```

#### Performance Testing
```typescript
describe('performance', () => {
  it('should render without performance regression', async () => {
    const { container } = render(<App />);
    const start = performance.now();

    // Trigger expensive operations
    fireEvent.click(screen.getByText('Add Crate'));

    const end = performance.now();
    expect(end - start).toBeLessThan(100); // 100ms budget
  });
});
```

This engineering documentation provides the foundation for understanding and maintaining the Crate Tracker codebase. The implementation follows modern React patterns, emphasis on developer experience, comprehensive testing, and production-ready performance considerations.
