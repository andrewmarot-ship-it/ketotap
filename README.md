# KetoTap 🥑

> Tap. Track. Keto.

A mobile-first, tap-based ketogenic macro tracker. Log food instantly using large bingo-style food tiles — no typing required.

## Stack

- **Frontend:** React (Vite), React Router, Axios
- **Backend:** Node.js, Express, better-sqlite3, JWT auth, bcryptjs
- **Database:** SQLite (file-based, zero config)

## Running Locally

### Backend
```bash
cd backend
npm install
npm start       # runs on port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # runs on port 3000, proxies /api → :3001
```

Open http://localhost:3000

## Features

- **Authentication** — Email/password login, registration, password reset, persistent JWT sessions
- **Macro Tracker** — Real-time calorie, fat, protein, and net carb tracking with progress bars
- **Food Grid** — Bingo-style tap grid; single tap = +1 serving, long press = remove serving
- **Food Inventory** — Add, edit, delete foods with auto image lookup
- **Daily History** — Browse past 30 days with per-day food breakdown
- **Profile & Targets** — Set custom daily macro targets, stored per user

## Brand Colors

| Color | Hex |
|-------|-----|
| Primary Green | `#2ECC71` |
| Deep Accent | `#1B5E20` |
| Warning | `#F39C12` |
| Over Limit | `#E74C3C` |
| Background | `#F8F9F7` |
