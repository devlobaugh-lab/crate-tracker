# Crate Tracker (React + Vite + Tailwind)

A simple mobile-first web app for tracking crate openings in a game. Stores data locally using `localStorage`.

## Features
- Tracks all crate openings and shows last 10 and next 10 crates.
- Config page for Wins and GP Wins
- Persists data using `localStorage`.
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

### Run with Docker Compose
```bash
docker compose up --build
```
Access app at http://localhost:3000
