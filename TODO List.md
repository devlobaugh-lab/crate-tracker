# TODO List - Code Quality Improvements

## Code Review Summary
Completed analysis of the crate-tracker-vite codebase identifying key issues in readability, security, and stability.

## Phase 1: Implement Clean Logging System
- [x] Create src/utils/logger.ts with conditional development logging
- [x] Replace all console.log/debug calls in firebase.ts with logger utility
- [x] Replace console.log/debug calls in AuthContext.tsx with logger calls
- [x] Replace console.log/debug calls in App.tsx with logger calls

## Phase 2: Refactor Oversized Components
- [ ] Extract useOfflineSync hook from AuthContext.tsx (offline detection & queue management)
- [ ] Extract useDebouncedSave hook from AuthContext.tsx (data persistence logic)
- [ ] Extract useAppState hook from App.tsx (main app state management)
- [ ] Extract useCrateManagement hook from App.tsx (add/undo crate operations)

## Phase 3: Simplify Sync and Type Management
- [ ] Create useSyncManager hook to centralize online/offline detection
- [ ] Refactor AuthContextType into focused interfaces:
  - AuthenticationType (auth-related methods)
  - DataManagementType (save/load/userData operations)
  - SyncManagementType (online/offline queue management)
- [ ] Simplify firebase.ts by removing global console overrides

## Phase 4: Enhance Security & Input Validation
- [ ] Install and implement Zod schema validation for user data import/export
- [ ] Install file-saver library to replace direct DOM manipulation in exportUserData
- [ ] Add proper input sanitization for all user-imported data
- [ ] Validate Firebase configuration environment variables

## Phase 5: Production Error Reporting
- [ ] Add Sentry SDK for production error tracking and reporting
- [ ] Replace global console overrides with proper Firebase error handler
- [ ] Implement structured error logging throughout the application

## Phase 6: Testing & Performance
- [ ] Write integration tests for offline sync scenarios and queue management
- [ ] Add performance tests for debounced save operations
- [ ] Implement React.memo and useMemo optimizations for expensive operations
- [ ] Consider pagination for large crate histories (if applicable)

## Phase 7: Code Quality Verification
- [ ] Run full test suite after each phase
- [ ] Verify ESLint rules are passing
- [ ] Manual testing of offline/online functionality
- [ ] Performance testing and bundle size analysis
