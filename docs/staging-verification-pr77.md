# Staging Verification — PR #77 (Security Hardening)

PR: https://github.com/devlobaugh-lab/crate-tracker/pull/77
Branch: `refactor/security-review`

Deploy to staging first: push the branch, let CI run, then proceed with the checks below.

---

## 1. HTTP Security Headers (Claude can do this)

After staging deploy, give Claude the staging URL and run:

```bash
curl -I <staging-url>
```

Expected headers in the response:
- `x-frame-options: DENY`
- `x-content-type-options: nosniff`
- `referrer-policy: strict-origin-when-cross-origin`
- `permissions-policy: camera=(), microphone=(), geolocation=()`
- `content-security-policy: default-src 'self'; ...`

---

## 2. Firestore Rules — Auth Flow (you must do this in browser)

**Sign in as a normal (non-admin) user:**
- Open the staging app
- Sign in with your regular Google account
- Confirm: app loads, crate data appears, no errors in the console

**If it fails:** you'll see a loading spinner that never resolves or a "not authorized" screen. Roll back immediately (see below).

---

## 3. Firestore Rules — Admin Panel (you must do this in browser)

**Sign in as an admin user:**
- Open the staging app
- Navigate to the Admin panel
- Confirm: the user list loads with all users visible

**If it fails:** the list will be empty or show a permission error.

---

## 4. Firestore Rules — Self-Read Restriction (Firebase Console)

Optional but thorough. In Firebase Console → Firestore → Rules → **Rules Playground**:

| Test | Operation | Path | Auth (uid / email) | Expected |
|------|-----------|------|--------------------|----------|
| Own doc readable | `get` | `/authorizedUsers/<your-email>` | your account | ✅ Allow |
| Other user's doc denied | `get` | `/authorizedUsers/<someone-elses-email>` | your non-admin account | ❌ Deny |
| Admin can read any | `get` | `/authorizedUsers/<any-email>` | admin account | ✅ Allow |

---

## Rollback Procedures

### Rollback Firestore rules (fastest — takes effect in seconds)

```bash
# Option A: restore from git
git show HEAD~2:firestore.rules | firebase deploy --only firestore:rules --project staging --stdin

# Option B: restore file then deploy
git checkout <commit-before-pr>^ -- firestore.rules
firebase deploy --only firestore:rules --project staging
```

The Firestore rules change is the only one likely to cause a staging issue. Roll back rules first, investigate second.

### Rollback HTTP headers

Remove the `headers` block from `firebase.json` and redeploy hosting:

```bash
firebase deploy --only hosting --project staging
```

### Rollback order if everything is broken

1. Roll back Firestore rules (instant effect, no build needed)
2. Roll back HTTP headers (hosting redeploy, ~1 min)
3. Full branch revert + CI redeploy (last resort)

---

## What each change does and its risk level

| Change | Risk | Rollback effort |
|--------|------|-----------------|
| pnpm migration | Low — same packages, different lockfile | High — requires reverting lockfile |
| Zod validation on import | Low — only affects malformed file imports | Low — one-line revert |
| Firestore rules | **Medium** — could break auth flow if misconfigured | Low — redeploy previous rules |
| Pin CI action tag | None at runtime | None |
| HTTP security headers | Low — browser-side only, no auth impact | Low — remove headers block, redeploy |
