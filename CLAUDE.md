# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Start dev server (port 5173)
npm run build         # Production build
npm run preview       # Preview built app

# Testing
npm run test          # Watch mode
npm run test:run      # Single run (CI mode)
npm run test:ui       # Interactive UI

# Code quality
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier format
npm run type-check    # TypeScript check (tsc --noEmit)

# Full CI pipeline
npm run ci            # type-check → lint → format:check → test:run → build
```

To run a single test file: `npx vitest run src/path/to/file.test.ts`

## Architecture

This is an offline-first React + Firebase SPA for tracking crate openings in F1 Clash. It predicts upcoming crates based on a known master pattern and tracks progress toward special crates (Platinum/Legend).

**Stack:** React 18 + TypeScript, Vite, TailwindCSS, Firebase (Auth + Firestore), Vitest + React Testing Library, Zod.

**Auth:** Invite-only Google authentication. `AuthContext.tsx` manages the auth state and wraps the app. Authorization is role-based (admin vs regular user) checked via `src/utils/authorization.ts`.

**View routing** is state-based (no router library). `App.tsx` controls a `view` state (`'intro' | 'main' | 'config' | 'admin'`) and a `showFastForward` modal flag. Views live in `src/components/views/`.

**State management** uses decentralized custom hooks:
- `useAppState` — core app state (crates, config), initializes from Firebase or localStorage
- `useCrateManagement` — `addCrate()`, `undoCrate()`, `fastForwardSubmit()` mutations
- `useCratePattern` — prediction algorithm (next 10 crates, next special crate)
- `useOfflineSync` — online/offline detection, action queuing, retry logic
- `useDebouncedSave` — debounces Firestore writes at 500ms

**Offline-first flow:** State updates immediately in React, then a debounced Firestore write fires. Firebase real-time listeners sync across devices. localStorage persists state during outages. A `ignoreRemoteChanges` flag prevents conflicts during bulk operations (fast-forward).

**Crate type encoding:** Single characters — `B` (Blue/Green), `G` (Gold), `P` (Platinum), `L` (Legend), `X` (GP), `?` (Unknown).

**Key utilities in `src/utils/`:**
- `constants.ts` — `MASTER_PATTERN`, crate types, storage keys
- `patternUtils.ts` — prediction algorithm (pattern matching)
- `validation.ts` — Zod schemas for data validation
- `logger.ts` — centralized logging
- `notifications.ts` — toast helpers

**Environment:** Firebase config loaded from `VITE_*` env vars. Two environments: staging (`.env.dev`) and production (`.env.prod`).

**Error handling:** Three nested error boundaries in `App.tsx` (generic → Firebase → Auth). Graceful degradation on network failures.
