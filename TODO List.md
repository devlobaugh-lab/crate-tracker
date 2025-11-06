# TODO List - 
# Features

# ~~Feature 1: Add invite system to unlock the app for people~~
*Implementation Plan: Gmail-only, invite-only access with admin controls*

### New Database Schema
**New Collection: `/authorizedUsers/{gmailAddress}`**
- email: string (lowercased Gmail address)
- role: 'admin' | 'normal'
- status: 'active' | 'inactive'
- invitedBy?: string (Gmail of inviting admin)
- invitedAt?: Timestamp
- createdAt: Timestamp
- updatedAt: Timestamp

**Extended User Collection: `/users/{userId}`**
- Add role field from authorizedUsers
- Add authorized: boolean field

## Phase 1: Database & Security Foundation
- [x] Create `/functions` directory and Firebase Functions setup
- [x] Add `/authorizedUsers` schema to Firestore rules (admin-only read/write)
- [x] Update existing `/users` security rules for role-based access
- [x] Manually create initial admin record in Firestore
- [x] Update TypeScript types for new user management interfaces

## Phase 2: Authorization System
- [x] Create user authorization service (`src/utils/authorization.ts`)
- [x] Modify AuthContext to check `/authorizedUsers` post-Firebase-auth
- [x] Add role synchronization between `/users` and `/authorizedUsers`
- [x] Implement unauthorized user state UI (invite-only message)
- [x] Update sign-in flow with access verification

## Phase 3: Admin Interface Components
- [x] Create `src/components/views/AdminView.tsx`
- [x] Build user management table (list/add/edit/deactivate users)
- [x] Add role toggle functionality (normal ↔ admin)
- [x] Implement Gmail address validation and normalization
- [x] Add admin panel access button to ConfigView (role-based visibility)

## Phase 4: Email Invitation System (External SMTP)
- [x] Set up email sending through Google SMTP (via external script)
- [x] Create `scripts/send-invite.js` for automated email sending
- [x] Add nodemailer integration to main project
- [x] Add invite sending functionality to AdminView (with preview)
- [x] Implement user authorization without automatic email sending
- [x] Add invite email UI with admin email preview and copy/paste options
- [x] Update documentation for external SMTP setup

## Phase 5: Testing & Production Readiness
- [x] Create admin user management tests
- [x] Test invite email workflow end-to-end
- [x] Validate Gmail-only restriction
- [x] Security audit: prevent admin privilege escalation
- [x] Deploy Firebase Functions and update client configuration

# ~~Feature 2 - Fast forward~~
## Want to give the user a way to enter in a new number of wins (larger than current), and have the application add that number of crates to the crate history, using its predictive algo so the user can "catch up"
### Use case: User needs to be able to enter in an updated GP win count too and have GP crates added to history.
### Note: This is different than just editing the Total count and GP wins values.
### App flow
- I'm thinking there could be a fast-forward button that would show the number of GP and total wins and would prompt the user for new values for both.
- It should prompt for GP wins first
- The app will then add the number of new GP crates (new GP crates - old GP crates)
- The app will add these new crates to the total wins amount
- the app will then prompt the user for the new total wins count
- The app will add the number of crates of the diff (new total wins - old total wins)
- The app will use the predictor to determine which crate to enter.

## Feature 2 Implementation
- [x] Add Fast Forward button to main view
- [x] Create FastForward modal component with two-step prompt flow
- [x] Implement fast-forward handler in App.tsx with bulk addition logic
- [x] Add validation (new values >= current values)
- [x] Handle sync/state updates with setIgnoreRemoteChanges
- [x] Test edge cases (prediction with '?', large diffs)

# ~~Feature 3: Add number of crates until Platinum/Legend~~
### Documentation
- Objective: Add a text blurb in the header of the "Next 10 crate section" on the far right saying "$x number of crates until $(Platinum | Legend)"
- Technical Approach: Use the predictor to find the next known Platinum ('P') or Legend ('L') crate in the 10-crate prediction window
- Edge Cases: Only show blurb when predictions are certain (no '?' ambiguities); hide if no P/L predicted in next 10 crates

### Feature 3 Implementation Plan
- [x] Create utility function `findNextSpecialCrate()` in `src/utils/patternUtils.ts` to locate first definite P/L in predictions array
- [x] Extended search to look up to 100 crates ahead to find special crates even when close-range predictions are uncertain
- [x] Extend `useCratePattern` hook in `src/hooks/useCratePattern.ts` to compute and return next special crate data (always returns { count, type })
- [x] Update "Next 10 (predictions)" section header in `App.tsx` to display countdown blurb with flex layout (title left, blurb right), handling all cases
- [x] Verify development server launches without errors and all tests pass (91 passed, 7 skipped)
- [x] Tested extended search finds special crates (e.g., "BBGBBGB" finds Legendary in 15 crates vs previously null)

# Code Quality Improvements
## Code Improvements
Key issues to make in readability, security, and stability.

## Code Review Summary
Completed comprehensive analysis of codebase identifying issues in readability, security, and stability:

## ~~Phase 1: Implement Clean Logging System~~
- [x] Create src/utils/logger.ts with conditional development logging
- [x] Replace all console.log/debug calls in firebase.ts with logger utility
- [x] Replace console.log/debug calls in AuthContext.tsx with logger calls
- [x] Replace console.log/debug calls in App.tsx with logger calls

## ~~Phase 1b: Optimize Github workflow - branch strategy and use of Github releases~~
- [x] Research how Github releases work 
- [x] Adjust branching strategy accordingly
- [x] Adjust CI and auto deploy accordingly
- [x] Review github rules and adjust to match flow (e.g. pre-reqs to prod deploy)

## ~~Phase 2: Refactor Oversized Components & Documentation~~
- [x] Extract useOfflineSync hook from AuthContext.tsx (offline detection & queue management)
- [x] Extract useDebouncedSave hook from AuthContext.tsx (data persistence logic)
- [x] Extract useAppState hook from App.tsx (main app state management)
- [x] Extract useCrateManagement hook from App.tsx (add/undo crate operations)
- [x] Add JSDoc comments to complex functions (saveUserData, authorization logic, etc.)
- [x] Document key business logic and edge cases in comments

## ~~Phase 3: Simplify Sync and Type Management~~
- [x] Create useSyncManager hook to centralize online/offline detection
- [x] Refactor AuthContextType into focused interfaces:
  - AuthenticationType (auth-related methods)
  - DataManagementType (save/load/userData operations)
  - SyncManagementType (online/offline queue management)
- [x] Simplify firebase.ts by removing global console overrides

## ~~Phase 4: Enhance Security & Input Validation~~
- [x] Install and implement Zod schema validation for user data import/export
- [x] Install file-saver library to replace direct DOM manipulation in exportUserData
- [x] Add proper input sanitization for all user-imported data
- [x] Validate Firebase configuration environment variables
- [x] Move hardcoded app URLs to environment configuration
- [x] Add admin safety: prevent last admin from demoting/deactivating themselves
- [x] Add input validation to prevent negative GP wins or total wins in fast forward

## ~~Phase 5: Enhanced Error Handling & User Feedback~~
- [x] Replace global console overrides with proper Firebase error handler
- [x] Implement structured error logging throughout the application
- [x] Add toast notification system for user feedback on operations and errors
- [x] Integrate toast notifications with error boundaries and async operations
- [x] Create custom error aggregator for development debugging (free tier compatible)

## ~~Phase 6: Testing & Performance~~ ✅
- [x] Complete the skipped admin function tests (toggleUserStatus, deleteUser edge cases)
- [ ] Write integration tests for offline sync scenarios and queue management (future enhancement)
- [ ] Add performance tests for debounced save operations (future enhancement)
- [x] Implement React.memo and useMemo optimizations for expensive operations
- [ ] Consider pagination for large crate histories (if applicable - not needed for current scale)

## ~~Phase 7: Code Quality Verification~~ ✅
- [x] Run full test suite after each phase (91 passed, 11 skipped)
- [x] Verify ESLint rules are passing (exit code 0, no errors)
- [x] Manual testing of offline/online functionality (dev server running)
- [x] Performance testing and bundle size analysis (738.74 kB JS, 193.66 kB gzipped)
