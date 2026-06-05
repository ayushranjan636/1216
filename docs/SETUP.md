# 1216 — Setup Guide

Private web app for two — React + Vite, backed by **Supabase** (production) or local SQLite (dev).

## Production (Supabase + Vercel)

See **[DEPLOY.md](./DEPLOY.md)** for full steps.

```bash
cd web
cp .env.example .env
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Login with **email + password** (Supabase Auth). Quick-sign-in buttons are removed.

## Local dev (SQLite server)

**Terminal 1:**
```bash
cd server && npm install && npm start
```

**Terminal 2:**
```bash
cd web && npm install && npm run dev
```

`web/.env`:
```env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
VITE_RELATIONSHIP_START=2022-08-17
```

## Demo mode (no backend)

```env
VITE_DEMO_MODE=true
```

Uses in-browser storage only — good for UI testing.

## Features

- Chat with reactions, reply, edit, view-once media
- Snaps tab (view once)
- Voice & video calls (WebRTC + Supabase signaling)
- Memories, daily notes, favorites
- Dark / light themes
- Mobile bottom navigation

## Project structure

```
1216/
├── web/                 # React frontend (deploy to Vercel)
├── supabase/migrations/ # SQL schema
├── server/              # Optional local SQLite API
└── docs/
    ├── DEPLOY.md
    └── ARCHITECTURE.md
```
