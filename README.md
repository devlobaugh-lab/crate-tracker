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
- Requires login with google account
    - allows app to have different users with different save data
    - data is saved in cloud (firebase), allowing user to move between devices
- Mobile-first responsive layout using TailwindCSS.
- Dockerized for easy deployment.
- Setup to be hosted on Firebase as well. 

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
