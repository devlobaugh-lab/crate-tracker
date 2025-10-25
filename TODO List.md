# TODO List - GitHub Integration

## Phase 1: GitHub Actions CI

- [x] Set up GitHub repository for crate-tracker-vite
- [x] Create .github/workflows directory
- [x] Configure CI workflow file (.github/workflows/ci.yml)
  - [x] Install Node.js and dependencies
  - [x] Run linting (ESLint)
  - [x] Run tests (if any exist)
  - [x] Build the project with Vite
- [x] Test CI workflow locally or push to trigger
- [x] Add badges to README.md for CI status

## Phase 2: GitHub Actions Deploy to Firebase

- [x] Configure Firebase CLI in CI
  - [x] Set up Firebase service account key as secret
  - [x] Install Firebase CLI in workflow
- [x] Update deploy workflow file (.github/workflows/deploy.yml)
  - [x] Build the project
  - [x] Deploy to Firebase Hosting
  - [x] Optionally deploy Firestore rules if needed
- [x] Set up deployment triggers (on push to main branch)
- [x] Configure Firebase project settings for deployment
- [x] Test deployment by merging to main branch
- [x] Verify site is live on Firebase Hosting

## Phase 3: Additional Integrations (if applicable)

- [x] Set up dependency vulnerability scanning
- [x] Configure code coverage reports
- [x] Add auto-formatting or other checks

