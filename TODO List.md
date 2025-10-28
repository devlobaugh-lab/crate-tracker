# TODO List - Code Quality Improvements
## Features
## 1: Add invite system to unlock the app for people
*Implementation Plan: Gmail-only, invite-only access with admin controls*

### Prerequisites & Decisions
- Email Service: Firebase Functions with SendGrid integration
- Initial Admin: Manual Firestore document creation
- User Base: Restricted to Gmail addresses only
- Seeding: Create script later for automated admin setup

### Database Schema
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
- [ ] Build user management table (list/add/edit/deactivate users)
- [ ] Add role toggle functionality (normal ↔ admin)
- [ ] Implement Gmail address validation and normalization
- [x] Add admin panel access button to ConfigView (role-based visibility)

## Phase 4: Email Invitation System
- [ ] Set up Firebase Functions with SendGrid integration
- [ ] Create `sendInvite` Cloud Function with email template
- [ ] Add invite sending functionality to AdminView
- [ ] Implement invitation status tracking
- [ ] Add invite email UI with admin email preview

## Phase 5: UI Integration & UX
- [ ] Update Login component for invite-only messaging
- [ ] Add "Request Access" flow for unauthorized Gmail users
- [ ] Handle role-based feature access throughout app
- [ ] Add loading states and error handling for authorization checks

## Phase 6: Testing & Production Readiness
- [ ] Create admin user management tests
- [ ] Test invite email workflow end-to-end
- [ ] Validate Gmail-only restriction
- [ ] Security audit: prevent admin privilege escalation
- [ ] Deploy Firebase Functions and update client configuration

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
