# Architecture

## Overview

1216 is a two-user private messaging web app with voice/video calling, built on React (Vite) with an Express + SQLite backend and WebRTC peer connections.

```
┌─────────────────────────────────────────────────────────┐
│                     Web App (Vite)                       │
├─────────────┬──────────────┬──────────────┬─────────────┤
│ React Router│   Zustand    │  Components  │  WebRTC     │
│  (Pages)    │  (State)     │  (UI)        │  (Calls)    │
├─────────────┴──────────────┴──────────────┴─────────────┤
│                      Service Layer                       │
│  api │ messages │ chat │ signaling │ notifications     │
├─────────────────────────────────────────────────────────┤
│              Express API + WebSocket (server/)           │
│  Auth │ SQLite │ Media uploads │ Call signals           │
└─────────────────────────────────────────────────────────┘
```

## Routes

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Account sign-in |
| `/chat` | Chat | iMessage-style messaging |
| `/snaps` | Snaps | View-once snap viewer |
| `/calls` | Call Logs | Voice/video history |
| `/profile` | Profile | Stats, theme, relationship counter |
| `/memories` | Memories | Shared photo gallery |
| `/daily-note` | Daily Note | Send love notes |
| `/favorites` | Favorites | Saved messages |

## State Management (Zustand)

| Store | Responsibility |
|-------|----------------|
| `authStore` | User session, profile, partner |
| `chatStore` | Messages, typing, reply/edit context |
| `callStore` | Active call, mute/camera toggles, streams |
| `themeStore` | Dark / light appearance |

## Data Flow

### Messaging
1. User sends → `POST /messages` → SQLite
2. Server broadcasts via WebSocket → `subscribeMessages()` → UI updates
3. Chat channel excludes `type=snap`; snaps use `/snaps` endpoint

### View-once & Snaps
1. Attach with view-once flag or send via Snaps tab
2. Recipient opens → `POST /messages/:id/view` marks viewed
3. Snap messages use `type=snap` and auto view-once

### Calls
1. Caller → `POST /calls` creates session
2. Callee receives via WebSocket incoming-call event
3. WebRTC offer/answer/ICE exchanged via `call_signals` table
4. Call end → update status, cleanup signals

### Media
1. Pick image/video → upload to `POST /media`
2. Store URL in message record

## Design System

Located in `web/src/index.css` and `web/src/components/Layout.css`:
- **Themes**: Dark and light with liquid glass panels
- **Icons**: SVG icon set (no emoji UI)
- **Typography**: System font stack (SF Pro equivalent)
- **Components**: Glass cards, frosted blur, iOS-inspired spacing

## Security Model

- Only 2 predefined accounts (Ayush / Anushka)
- Token-based auth with signed session tokens
- No public registration endpoint
- Media stored locally on server (`server/uploads/`)

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `react-router-dom` | Client routing |
| `zustand` | Lightweight state |
| `express` + `better-sqlite3` | API + persistence |
| `ws` | Real-time WebSocket |
| WebRTC APIs | Voice/video calls |
