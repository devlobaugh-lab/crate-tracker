# Crate Tracker (React + Vite + Tailwind)

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
- User is only allowed to be logged into one device at a time (it will log you out of others)
- Mobile-first responsive layout using TailwindCSS.
- Dockerized for easy deployment.

## Setup
```bash
npm install
npm run dev
```
App runs at http://localhost:5173

### Build for production
```bash
npm run build
```

## Docker
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

