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

**Data shape:**
```typescript
AppState = {
  series: [{ allCrates: string[] }, ...], // array of 12, one per series
  config: { wins: number, gpWins: number } // global cross-series totals
}
```
`currentSeriesIndex` (0–11) is UI-only state owned by `App.tsx`, persisted to `localStorage('crate-tracker-series-index')`. The series selector in the header (a `<select>`) replaces the old `<h1>Crate Tracker</h1>`.

**Migration:** `migrateToMultiSeries()` in `validation.ts` handles legacy single-series data (`allCrates` at top level → placed into `series[11]`). Called in `AuthContext.loadUserData` (Firestore), `useOfflineSync.loadOfflineData` (localStorage), and the real-time `onSnapshot` listener. When migration runs, the result is written back to Firestore immediately (non-debounced) and `wasMigrated: true` is exposed via AuthContext, which causes App.tsx to redirect `currentSeriesIndex` to 11 so users land on their data.

**State management** uses decentralized custom hooks:
- `useAppState` — core app state (series + config), initializes from Firebase or localStorage
- `useCrateManagement` — `addCrate()`, `undoCrate()`, `fastForwardSubmit()` mutations scoped to `currentSeriesIndex`; global config tracks cross-series win totals
- `useCratePattern` — prediction algorithm (next 10 crates, next special crate), receives current series slice
- `useOfflineSync` — online/offline detection, action queuing, retry logic
- `useDebouncedSave` — debounces Firestore writes at 500ms

**Offline-first flow:** State updates immediately in React, then a debounced Firestore write fires. Firebase real-time listeners sync across devices. localStorage persists state during outages. A `ignoreRemoteChanges` flag prevents conflicts during bulk operations (fast-forward).

**Crate type encoding:** Single characters — `B` (Blue/Green), `G` (Gold), `P` (Platinum), `L` (Legend), `X` (GP), `?` (Unknown).

**Export/import:**
- Export: always v2 JSON (`{ version: 2, series, config, exportedAt }`).
- Import v2 file: full restore of all 12 series + config.
- Import legacy file (has `allCrates`, no `version`): restores into current series only; other series and config unchanged.
- Reset: clears only `series[currentSeriesIndex].allCrates`; global config untouched.

**Key utilities in `src/utils/`:**
- `constants.ts` — `MASTER_PATTERN`, crate types, storage keys
- `patternUtils.ts` — prediction algorithm (pattern matching)
- `validation.ts` — Zod schemas, `migrateToMultiSeries()`, `ImportResult` union type
- `logger.ts` — centralized logging
- `notifications.ts` — toast helpers

**Environment:** Firebase config loaded from `VITE_*` env vars. Two environments: staging (`.env.dev`) and production (`.env.prod`).

**Error handling:** Three nested error boundaries in `App.tsx` (generic → Firebase → Auth). Graceful degradation on network failures.
