# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev:backend          # Start backend (nodemon, port 3001)
npm run dev:frontend         # Start frontend (Vite, port 3000)

# Production
npm run build:frontend       # Build frontend to frontend/dist/
npm run start:backend        # Start backend (serves frontend/dist as static)

# Frontend only
cd frontend && npm run lint  # ESLint

# Run single backend file (no test framework — manual testing via curl/HTTP client)
node backend/src/<file>.js
```

Backend requires a `.env` file in `backend/`:
```
USDA_FDC_API_KEY=DEMO_KEY
JWT_SECRET=<secret>
PORT=3001
```

## Architecture

KetoTap is a mobile-first keto macro tracker. The frontend is a Vite/React 19 SPA; the backend is Express + SQLite (better-sqlite3, no ORM).

**Frontend** (`frontend/src/`):
- `pages/` — route-level components (Dashboard, Foods, History, Profile, Login/Register)
- `components/` — reusable UI (FoodGrid bingo-tap grid, PortionPickerSheet bottom sheet, MacroBar, PresetsRow, BottomNav)
- `context/AuthContext.jsx` — global auth state; JWT stored in `localStorage` as `kt_token`
- `api/client.js` — Axios instance with JWT interceptor; dev proxy routes `/api` → `:3001`

**Backend** (`backend/src/`):
- `index.js` — Express app, mounts all route files
- `db.js` — SQLite schema, additive try/catch migrations (run on every startup), and seed data (24 default foods)
- `middleware/auth.js` — JWT verification
- `routes/` — `auth`, `foods`, `logs`, `targets`, `nutrition`, `presets`

**Database:** Single SQLite file at `backend/ketotap.db`. Schema migrations are additive `ALTER TABLE` statements wrapped in try/catch so they're safe to re-run. No migration tooling.

**USDA FDC integration** (`routes/nutrition.js`): Nutrition lookups are cached 24h; on a 429 rate-limit the backend serves stale cache (up to 7 days) instead of failing.

**Deployment:** Railway with Nixpacks. Build runs `frontend npm build` then `backend npm ci`; start command runs `backend/src/index.js` which serves `frontend/dist` as static files.

## Key Patterns

- **No TypeScript** — plain JS/JSX throughout.
- **Auth flow:** register/login → JWT (30-day) → stored in localStorage → Axios interceptor attaches `Authorization: Bearer` header.
- **Beta gate:** `localStorage.kt_beta` key gates access; `BetaGatePage` checks it.
- **Portion multiplier:** Each log entry has a `portion_multiplier` (0.5, 1, or 2) adjusted via `PATCH /api/logs/:id`.
- **Seed foods:** On startup, db.js deterministically replaces seed foods (global) and adds per-user copies for any missing seeds.
- **Design system:** `frontend/DESIGN_SYSTEM.md` has the full color palette, spacing, and component patterns. Brand is warm, avocado-inspired (greens + browns).
