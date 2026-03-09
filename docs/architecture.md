# Architecture

## Overview

Crate Tracker is an offline-first single-page application built with React and Firebase. Users log crate wins, the app predicts upcoming crates using a master pattern algorithm, and everything syncs across devices in real time.

---

## Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | TailwindCSS (mobile-first) |
| Auth & Database | Firebase (Auth + Firestore) |
| Validation | Zod |
| Notifications | react-hot-toast |
| Testing | Vitest + React Testing Library |

---

## Application Structure

There's no client-side router. Navigation is controlled by a `view` state variable in `App.tsx`:

```text
'intro'  →  First-time onboarding (no crate history yet)
'main'   →  Primary tracking interface
'config' →  Settings, backup/restore, admin access
'admin'  →  User management (admin role only)
```

A `showFastForward` boolean controls the Fast Forward modal, which overlays any view.

---

## State Management

The app uses React Context combined with a set of custom hooks. There is no Redux or external state library.

### Hook responsibilities

| Hook | Responsibility |
| ---- | -------------- |
| `useAppState` | Core state (crates array + config). Initializes from Firebase or localStorage. |
| `useCrateManagement` | Mutations: `addCrate`, `undoCrate`, `fastForwardSubmit` |
| `useCratePattern` | Derives predictions and special crate countdown from current history |
| `useOfflineSync` | Detects online/offline, queues actions, handles retry |
| `useDebouncedSave` | Throttles Firestore writes to 500ms |
| `useIgnoreRemoteChanges` | Prevents sync conflicts during bulk operations |

### Data flow

```text
User action (tap crate, undo, fast forward)
  ↓
setState() updates React state immediately (instant UI feedback)
  ↓
useEffect triggers debounced save (500ms delay)
  ↓
Online → write to Firestore → Firebase listener broadcasts to other devices
Offline → write to localStorage → queued for retry when connection returns
```

### Conflict prevention

The Fast Forward operation adds potentially hundreds of crates at once. During this operation, `ignoreRemoteChanges` is set to `true` for 10 seconds to prevent incoming Firebase sync events from overwriting the in-progress bulk update.

---

## Offline-First Design

Every state change writes to localStorage immediately. Firestore writes are secondary (debounced, may fail). This means:

- The app is fully functional with no internet connection
- No data is lost during network outages
- On reconnect, localStorage data is synced to Firestore
- localStorage is cleared after a successful Firestore sync

---

## Authentication & Authorization

Firebase Auth handles Google OAuth. Authorization (who can actually use the app) is a separate layer:

1. **Firebase Auth** — Google sign-in, token management
2. **`authorizedUsers` collection** — admin-managed whitelist of Gmail addresses
3. **Firestore security rules** — enforce that users can only read/write their own data

On login, the app checks whether the signed-in email exists in `authorizedUsers` and has `status: 'active'`. If not, the user sees the Unauthorized Access screen. Admins have a `role: 'admin'` field that unlocks the admin panel and grants read/write access to the full `authorizedUsers` collection.

---

## Data Model

### Firestore collections

**`users/{userId}`** — crate tracking data

```typescript
{
  allCrates: string[]        // ordered history of crate types
  config: {
    wins: number             // total win count
    gpWins: number           // GP-specific win count
  }
}
```

**`authorizedUsers/{email}`** — access control

```typescript
{
  email: string              // lowercase Gmail address (also the document ID)
  role: 'admin' | 'normal'
  status: 'active' | 'inactive'
  invitedBy: string          // email of the admin who added them
  invitedAt: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### Crate encoding

Crate types are stored as single characters:

| Character | Crate type |
| --------- | ---------- |
| `B` | Green (standard) |
| `G` | Gold |
| `P` | Platinum |
| `L` | Legendary |
| `X` | GP (Grand Prix / blue) |
| `?` | Unknown |

### localStorage

Keyed at `crate-tracker:v1`. Same shape as the Firestore `users` document.

---

## The Prediction Algorithm

F1 Clash crates follow a fixed 810-element master pattern. The algorithm works by finding where the user's history sits in that pattern.

### How it works

1. Slide through every possible starting position in the master pattern
2. At each position, check whether the sequence matches the user's crate history
3. Collect all positions that match
4. Look at the next N elements after each match
5. Where all matching positions agree → return that value
6. Where they disagree → return `?`

This means:

- With no history: all predictions are `?`
- With a short history: some predictions may be `?` (ambiguous)
- With enough history to uniquely identify position: all predictions are certain

### Special crate lookahead

The "next Platinum/Legendary" counter uses the same algorithm but scans up to 100 positions forward, not just 10. It returns the first position where a Platinum (`P`) or Legendary (`L`) appears with certainty across all matching positions.

---

## Deployment

### Environments

| Environment | Trigger | Firebase project |
| ----------- | ------- | ---------------- |
| Production | Push to `main` | `crate-tracker-38b6e` |
| Staging | Push to `staging` or manual | `crate-tracker-staging` |

### CI/CD pipeline

GitHub Actions runs the full check suite before deploying:

```bash
npm run type-check
npm run lint
npm run format:check
npm run test:run
npm run build
firebase deploy
```

Both environments use separate sets of `VITE_FIREBASE_*` environment variables injected as GitHub Actions secrets.

Firebase Hosting is configured as a SPA — all paths rewrite to `index.html`.

---

## Error Handling

Three nested error boundaries in `App.tsx` catch different failure modes:

```text
ErrorBoundary (generic)
  └─ FirebaseErrorBoundary (Firebase-specific, handles COOP policy issues)
       └─ AuthErrorBoundary (auth-specific failures)
            └─ AuthProvider → AppContent
```

Each boundary shows a fallback UI rather than a blank screen or uncaught exception.
