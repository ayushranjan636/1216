# Supabase + Vercel Deployment

Stack: **Vercel** (frontend) · **Supabase** (database, auth, storage, realtime)

Monthly cost: **₹0** for MVP demos and early users.

## 1. Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Copy **Project URL** and **anon public key**

## 2. Run database migration

In Supabase Dashboard → **SQL Editor**, paste and run:

```
supabase/migrations/001_schema.sql
```

Enable **Realtime** for `messages`, `calls`, `call_signals` (included in migration).

Create storage bucket **media** (private) if not auto-created.

## 3. Create two users (Auth)

Dashboard → **Authentication** → **Users** → Add user:

| Email | Display name (metadata) |
|-------|-------------------------|
| `ayush@yourdomain.com` | Ayush |
| `anushka@yourdomain.com` | Anushka |

Set strong passwords. Only these two accounts can access the app (RLS couple policy).

Optional: disable public sign-ups under Auth → Providers → Email.

## 4. Deploy frontend to Vercel

```bash
cd web
npm install
npm run build
```

**Vercel project settings:**
- Root directory: `web`
- Build command: `npm run build`
- Output directory: `dist`

**Environment variables:**

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon key |
| `VITE_RELATIONSHIP_START` | `2022-08-17` |

Do **not** set `VITE_DEMO_MODE=true` in production.

## 5. Local development with Supabase

```bash
cp web/.env.example web/.env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

cd web && npm run dev
```

No local Express server needed when Supabase env vars are set.

## Architecture

```
Phone / Browser
      ↓
  Vercel (React SPA)
      ↓
  Supabase
    ├── Auth (email/password)
    ├── PostgreSQL (messages, calls, memories…)
    ├── Storage (photos, snaps, videos)
    └── Realtime (live chat + call signals)
```

WebRTC voice/video runs peer-to-peer in the browser; signaling uses Supabase Realtime + `call_signals` table.

## Mobile

- Add to Home Screen on iPhone/Android for app-like experience
- Bottom tab bar on phones (Chat, Snaps, Calls, Profile)
- Safe area padding for notched devices
- Touch-friendly 44px+ tap targets

## Legacy local server

The `server/` folder (SQLite + Express) still works for offline dev without Supabase. Set only:

```env
VITE_DEMO_MODE=false
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
```

Leave `VITE_SUPABASE_*` empty to use local mode.
