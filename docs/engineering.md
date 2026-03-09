# Engineering Guide

## Development Setup

```bash
git clone <repo>
cd crate-tracker-vite
npm install
```

Copy `.env.example` to `.env.dev` (staging) or `.env.prod` (production) and fill in your Firebase project credentials.

```bash
npm run dev        # start dev server on port 5173
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Single test run (CI) |
| `npm run test:ui` | Interactive test UI |
| `npm run lint` | Check for lint errors |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run format` | Format with Prettier |
| `npm run type-check` | TypeScript validation |
| `npm run ci` | Full CI pipeline (type-check → lint → format → test → build) |

Run a single test file:
```bash
npx vitest run src/utils/patternUtils.test.ts
```

---

## Project Structure

```
src/
├── App.tsx                    # Root component, error boundaries, view routing
├── AuthContext.tsx             # Auth + data management context provider
├── Login.tsx                  # Google sign-in UI
├── UserProfile.tsx            # User profile display
├── firebase.ts                # Firebase initialization
├── main.tsx                   # React entry point
│
├── components/
│   ├── common/
│   │   ├── ErrorBoundary.tsx  # Three error boundary variants
│   │   ├── SmallRow.tsx       # Crate box row (used for history + predictions)
│   │   └── UnauthorizedAccess.tsx
│   ├── crate/
│   │   └── CrateGrid.tsx      # Six crate buttons + Undo + Fast Forward
│   └── views/
│       ├── IntroView.tsx      # Onboarding screen
│       ├── ConfigView.tsx     # Settings, backup/restore
│       ├── AdminView.tsx      # User management
│       └── FastForward.tsx    # Bulk win entry modal
│
├── hooks/
│   ├── useAppState.ts         # Core state, initialization, debounced saves
│   ├── useCrateManagement.ts  # addCrate, undoCrate, fastForwardSubmit
│   ├── useCratePattern.ts     # Prediction derivation
│   ├── useDebouncedSave.ts    # 500ms Firestore write debounce
│   ├── useIgnoreRemoteChanges.ts  # Conflict prevention flag + timeout
│   └── useSyncManager.ts      # Online/offline detection, action queue
│
├── types/
│   └── index.ts               # All shared TypeScript interfaces
│
└── utils/
    ├── constants.ts           # MASTER_PATTERN, crate types, storage keys
    ├── patternUtils.ts        # Prediction algorithm
    ├── authorization.ts       # Admin role checking
    ├── validation.ts          # Zod schemas
    ├── notifications.ts       # Toast helpers
    ├── logger.ts              # Centralized logging
    └── performance.ts         # Performance monitoring
```

---

## Key Implementation Details

### Adding a crate

`useCrateManagement.addCrate(crateValue)` does the following atomically via `setState`:
- Appends the crate value to `allCrates`
- Increments `config.wins`
- If the crate is `X` (GP), also increments `config.gpWins`

The `useAppState` hook picks up the state change via `useEffect` and schedules a debounced Firestore write 500ms later.

### Undoing a crate

`undoCrate` pops the last element from `allCrates`, decrements `wins`, and decrements `gpWins` if the removed crate was `X`.

### Fast Forward

`fastForwardSubmit(additionalGP, newTotal)`:
1. Adds `additionalGP` × `X` crates to history (each increments both wins and gpWins)
2. Calculates remaining wins: `newTotal - (currentWins + additionalGP)`
3. For each remaining win, calls `getNextCrateValue()` — which runs the pattern algorithm against the current history — and appends the result
4. Sets `ignoreRemoteChanges = true` for 10 seconds to block incoming sync events during the bulk operation

### Pattern algorithm

Located in `src/utils/patternUtils.ts`. The master pattern is a string of 810 characters in `src/utils/constants.ts`.

**`nextPatternValues(history, masterPattern)`**
- For each position in the master pattern, check if the sequence at that position matches `history`
- Collect all matching positions
- For each of the next 10 slots, check what value all matching positions agree on
- Return the agreed value, or `?` if there's disagreement

**`findNextSpecialCrateExtended(history, masterPattern)`**
- Same position-finding logic, but looks up to 100 slots ahead
- Finds the first slot where all matches agree on `P` or `L`
- Returns `{ count, type }` or `null`

### Firebase sync

`AuthContext.tsx` attaches a Firestore `onSnapshot` listener to `users/{userId}` after login. When remote data arrives, `useAppState` merges it into local state — unless `ignoreRemoteChanges` is true.

Writes are debounced at 500ms via `useDebouncedSave`. If offline, the write is queued by `useSyncManager` and retried on reconnect.

---

## Firebase Configuration

Two projects:
- **Production**: `crate-tracker-38b6e` (default in `firebase.json`)
- **Staging**: `crate-tracker-staging`

### Deploying manually

```bash
# Production
firebase use production
npm run build
firebase deploy

# Staging
firebase use staging
npm run build
firebase deploy
```

### Firestore security rules

Rules are in `firestore.rules`. Key rules:
- `authorizedUsers` — users can read their own document; admins can read/write all
- `users` — authenticated, authorized users can only read/write their own document
- Everything else is denied by default

When you modify rules, deploy them separately:
```bash
firebase deploy --only firestore:rules
```

---

## Testing

Tests live alongside source files as `*.test.ts` or `*.test.tsx`. The test setup is in `src/test/`.

The most coverage-dense areas are the pattern utilities (`patternUtils.test.ts`) and Gmail validation. Component tests use React Testing Library with a jsdom environment.

```bash
npm run test:run          # all tests once
npm run test              # watch mode during development
npx vitest run src/utils  # run only utils tests
```

---

## Environment Variables

All Firebase config comes from `VITE_*` environment variables. The app validates these at startup.

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Staging uses a parallel set prefixed `VITE_FIREBASE_STAGING_*`, injected by GitHub Actions secrets.

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production — auto-deploys on push |
| `staging` | Staging — auto-deploys on push |
| `develop` | Integration branch for feature work |
| Feature branches | Branch from `develop`, PR back to `develop` |

---

## Logging

`src/utils/logger.ts` wraps `console` methods. In production builds, lower-priority logs are suppressed. Use the logger rather than `console.log` directly so output is consistent and controllable.
