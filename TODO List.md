# TODO List - GitHub Integration

## Phase 1: GitHub Actions CI

- [ ] Set up GitHub repository for crate-tracker-vite
- [ ] Create .github/workflows directory
- [ ] Configure CI workflow file (.github/workflows/ci.yml)
  - [ ] Install Node.js and dependencies
  - [ ] Run linting (ESLint)
  - [ ] Run tests (if any exist)
  - [ ] Build the project with Vite
  - [ ] Upload build artifacts (optional)
- [ ] Test CI workflow locally or push to trigger
- [ ] Add badges to README.md for CI status

## Phase 2: GitHub Actions Deploy to Firebase

- [ ] Configure Firebase CLI in CI
  - [ ] Set up Firebase service account key as secret
  - [ ] Install Firebase CLI in workflow
- [ ] Update deploy workflow file (.github/workflows/deploy.yml)
  - [ ] Build the project
  - [ ] Deploy to Firebase Hosting
  - [ ] Optionally deploy Firestore rules if needed
- [ ] Set up deployment triggers (on push to main branch)
- [ ] Configure Firebase project settings for deployment
- [ ] Test deployment by merging to main branch
- [ ] Verify site is live on Firebase Hosting

## Phase 3: Additional Integrations (if applicable)

- [ ] Set up dependency vulnerability scanning
- [ ] Configure code coverage reports
- [ ] Add auto-formatting or other checks
