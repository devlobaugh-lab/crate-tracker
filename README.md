# Crate Tracker (React + Vite + Tailwind)

![CI](https://github.com/devlobaugh-lab/crate-tracker/workflows/CI/badge.svg)

A simple mobile-first web app for tracking crate openings in a game. 
Data Storage and Auth services provided by Firebase

## Features
- Tracks all crate openings and shows last 10
- User enters the color crate they get as they win games. Win counter changes too
- App uses algorithm to predict the next 10 crates and displays those it is able.
- Has undo button to remove last crate entered (can be used multiple times)
- Config page
    - Allows user to adjust their number of Wins to match game value (they won't be starting at zero)
    - Allows user to reset all data in the app and start from scratch
    - Allows user to create a backup to file of their data (the crates they have entered and # of wins)
    - Allows user to load a file backup of their data.
- Requires login with google account (invite-only via admin)
    - allows app to have different users with different save data
    - data is saved in cloud (firebase), allowing user to move between devices
- Gmail-only invite system with admin controls
- Mobile-first responsive layout using TailwindCSS.
- Dockerized for easy deployment.
- Setup to be hosted on Firebase as well.

## Admin Invitation System

This app uses an invite-only system for security. Admins can invite Gmail users to join.

### For Admins: Sending Invitations

1. **Authorize User in App**: Use the Admin panel to add users (this grants database access)
2. **Send Email Externally**: Use the provided script or your own SMTP setup to send the invitation email

#### Option 1: Use the Provided Email Script

```bash
# Set up Gmail App Password
export SMTP_EMAIL="your-gmail@gmail.com"
export SMTP_PASSWORD="your-gmail-app-password"

# Send invitation
node scripts/send-invite.js user@gmail.com admin@gmail.com normal
```

**Setup Gmail App Password:**
1. Enable 2FA on your Gmail account
2. Generate an App Password: https://support.google.com/accounts/answer/185833

#### Option 2: Manual Email Sending

The admin interface provides:
- Email preview with HTML content
- Copy-to-clipboard buttons for HTML/text content
- Open in Gmail button with pre-filled content
- Raw email content you can use with any SMTP service (SendGrid, Mailgun, etc.)

## Setup

### Environment Variables
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace the placeholder values with your actual Firebase configuration:
   ```bash
   VITE_FIREBASE_API_KEY=your_actual_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

### Staging Environment Setup

This project supports multiple environments (staging and production) for safer deployments.

#### Creating Firebase Projects

1. **Production Project**: Already exists as `crate-tracker-38b6e`
2. **Staging Project**: Create a new Firebase project named `crate-tracker-staging`:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create new project "crate-tracker-staging"
   - Enable Authentication (Google provider)
   - Enable Firestore Database
   - Enable Hosting
   - Copy Firestore rules and indexes from production project

#### GitHub Secrets Configuration

For staging deployments to work, add the following secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
FIREBASE_STAGING_API_KEY=staging_api_key_here
FIREBASE_STAGING_AUTH_DOMAIN=crate-tracker-staging.firebaseapp.com
FIREBASE_STAGING_PROJECT_ID=crate-tracker-staging
FIREBASE_STAGING_STORAGE_BUCKET=crate-tracker-staging.appspot.com
FIREBASE_STAGING_MESSAGING_SENDER_ID=staging_sender_id_here
FIREBASE_STAGING_APP_ID=staging_app_id_here
FIREBASE_STAGING_SERVICE_ACCOUNT=staging_service_account_json_here
```

#### Development Workflow

- **Development**: Work on feature branches, test locally
- **Staging**: Push to `staging` branch to deploy to staging environment
- **Production**: Merge to `main` branch to deploy to production environment

The staging environment will be available at your staging project's hosting URL, allowing you to test changes before they go live.

### Local Development
```bash
npm install
npm run dev
```
App runs at http://localhost:5173

### Build for production
```bash
npm run build
```

## Firebase Deployment
```bash
cd <directory of this app>
npm run build
firebase login
firebase deploy --only hosting
```

## Docker Deployment 
### Run locally with Docker Compose
```bash
docker compose up --build
```

### Build Docker image (from app directory)
```bash
docker build -t crate-tracker .
```

### Tag image to prepare for registry push
```bash
docker tag crate-tracker ghcr.io/devlobaugh-lab/crate-tracker/crate-tracker:latest
```

### Push to Github Docker Container Registry
```bash
docker push ghcr.io/devlobaugh-lab/crate-tracker/crate-tracker:latest
```

Access docker version of app at http://localhost:3001 (unless docker compose is setup differently)

### Production Deployment with Environment Variables

For production deployment, set the following environment variables:

```bash
export VITE_FIREBASE_API_KEY="your_production_api_key"
export VITE_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
export VITE_FIREBASE_PROJECT_ID="your_project_id"
export VITE_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
export VITE_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
export VITE_FIREBASE_APP_ID="your_app_id"
```

Then run:
```bash
docker compose up --build
```

Or use a `.env` file in your production environment and ensure it's not committed to version control.
