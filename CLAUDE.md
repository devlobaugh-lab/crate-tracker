# CLAUDE.md

## Behavioral guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Documentation placement

- All markdown documentation created for this project must be created in the `./docs` folder, unless the user specifies otherwise.
- If the `docs/` folder does not exist when you create a new markdown file, create the folder first.
- Session transcripts go in the `./docs/transcripts/` sub-folder
- Do not place transcripts or other generated markdown outside `docs/` unless the user explicitly instructs you to.
- The `docs/` folder is tracked in the repository and may contain session transcripts and other project documentation.

## README placement

- `README.md` must always remain in the repository root. Never move it into `docs/`.

## Refactoring

Keep changes small, reviewable, and verifiable.

**Key principle:** one logical unit per change. Decompose a large refactor into small steps (extract function, update one caller, update next caller). Each step is a separate commit/PR.

**Workflow:**

1. **Explore dependencies first** — find every place a piece of code is used. Map the dependency graph before touching anything.
2. **Plan before coding** — map the refactor as a sequence of small steps. Define success criteria for each step and how you'll verify it.
3. **Work one step at a time** — for each step: write tests (if missing), make the change, verify tests pass, run the dev server and manually test, commit with a clear message.
4. **Request surgical changes** — be explicit about scope: "change only this function," "keep the API the same," "one file at a time."
5. **Review before each commit** — read the diff, run tests, run the dev server, manually test, verify no regressions.

**Do:**

- ✅ Change one function/component at a time
- ✅ Write tests before changing code (TDD)
- ✅ Verify each change before moving to the next
- ✅ Use explicit constraints when requesting changes
- ✅ Keep commits under 100 lines of net change when possible

**Don't:**

- ❌ Refactor across multiple files at once
- ❌ Defer testing/verification until all changes are done
- ❌ Ask for improvements beyond scope
- ❌ Combine multiple concerns in one commit

## Output expectations

When an AI agent generates code:

1. Generate complete, runnable files — no truncation with "... rest of code."
2. List any assumptions made at the end under `## Assumptions`.
3. List open questions needing human judgment under `## Open Questions`.
4. Do not generate migration files — note the EF command to run instead.


## Commands

```bash
# Development
pnpm dev              # Start dev server (port 5173)
pnpm build            # Production build
pnpm preview          # Preview built app

# Testing
pnpm test             # Watch mode
pnpm test:run         # Single run (CI mode)
pnpm test:ui          # Interactive UI

# Code quality
pnpm lint             # ESLint check
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier format
pnpm type-check       # TypeScript check (tsc --noEmit)

# Full CI pipeline
pnpm ci               # type-check → lint → format:check → test:run → build

# Package management
pnpm install          # Install all deps (replaces npm install)
pnpm add <pkg>        # Add a dependency (replaces npm install <pkg>)
pnpm add -D <pkg>     # Add a dev dependency
pnpm remove <pkg>     # Remove a dependency
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
