# TODO List - 
# Features
## Feature 1: Add invite system to unlock the app for people
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

# Feature 2 - Fast forward
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

# Code Quality Improvements
## Code Improvements
Key issues to make in readability, security, and stability.

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
