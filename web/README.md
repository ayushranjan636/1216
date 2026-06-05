# 1216 Web App

Private communication platform for two — **React.js** (React 19 + Vite).

## Run locally

**Start the API server first** (from repo root):
```bash
cd server && npm install && npm start
```

Then run the web app:
```bash
cd web
npm install
cp .env.example .env
npm run dev
```

Open **http://localhost:3000**

## Login

| Account | Password |
|---------|----------|
| `Ayush` | `Ayushka@1216` |
| `Anushka` | `Ayushka@1216` |

Use **Sign in as Ayush** or **Sign in as Anushka**. For calls, open two browser tabs — one per account.

## Environment

```env
VITE_DEMO_MODE=false
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
VITE_RELATIONSHIP_START=2022-08-17
```

Set `VITE_DEMO_MODE=true` for in-browser storage only (no server).

## Build for production

```bash
npm run build
npm run preview
```

Deploy the `dist/` folder to any static host. Point `VITE_API_URL` and `VITE_WS_URL` at your running API server.

## Features

- iMessage-style chat with reactions, reply, edit, delete
- View-once photos and videos
- Dedicated Snaps tab
- Voice & video calls (WebRTC) + screen share
- Call logs and browser notifications
- Dark / light liquid glass UI
- Profile with relationship counter
- Memories, daily notes, favorites
