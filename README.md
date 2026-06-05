# 1216

Private messaging for two — **React.js** web app, deployable on **Vercel + Supabase**.

## Stack

| Layer | Service |
|-------|---------|
| Frontend | Vercel |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |

## Quick start (Supabase)

1. Create a [Supabase](https://supabase.com) project
2. Run `supabase/migrations/001_schema.sql` in SQL Editor
3. Create two users in Auth (Ayush + Anushka emails)
4. Copy `web/.env.example` → `web/.env` and fill Supabase keys
5. `cd web && npm install && npm run dev`

Full deploy guide: [docs/DEPLOY.md](./docs/DEPLOY.md)

## Local fallback (no Supabase)

```bash
cd server && npm start   # Terminal 1
cd web && npm run dev    # Terminal 2
```

Set `VITE_API_URL=http://localhost:4000` in `web/.env` (leave Supabase vars empty).

## Mobile

Works on phones — bottom tab bar, safe areas, Add to Home Screen support.
