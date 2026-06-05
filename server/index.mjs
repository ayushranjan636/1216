import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Database from 'better-sqlite3';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, createHash } from 'crypto';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT ?? 4000;
const JWT_SECRET = process.env.JWT_SECRET ?? '1216-local-secret';
const CONVERSATION_ID = '1216-private-chat';

mkdirSync(join(__dirname, 'data'), { recursive: true });
mkdirSync(join(__dirname, 'uploads'), { recursive: true });

const db = new Database(join(__dirname, 'data', '1216.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    slot TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    text TEXT,
    media_url TEXT,
    media_thumbnail TEXT,
    reply_to_id TEXT,
    reply_to_preview TEXT,
    reactions TEXT DEFAULT '[]',
    status TEXT DEFAULT 'sent',
    edited_at INTEGER,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    read_by TEXT DEFAULT '[]',
    view_once INTEGER DEFAULT 0,
    viewed_by TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    caller_id TEXT NOT NULL,
    callee_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at INTEGER,
    ended_at INTEGER,
    duration INTEGER
  );

  CREATE TABLE IF NOT EXISTS call_signals (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

try { db.exec('ALTER TABLE messages ADD COLUMN view_once INTEGER DEFAULT 0'); } catch { /* exists */ }
try { db.exec('ALTER TABLE messages ADD COLUMN viewed_by TEXT DEFAULT \'[]\''); } catch { /* exists */ }

const ACCOUNTS = {
  Ayush: { slot: 'ayush', password: 'Ayushka@1216', uid: 'user-ayush', displayName: 'Ayush', email: 'ayush@1216.app' },
  Anushka: { slot: 'partner', password: 'Ayushka@1216', uid: 'user-partner', displayName: 'Anushka', email: 'anushka@1216.app' },
};

for (const [username, a] of Object.entries(ACCOUNTS)) {
  db.prepare(
    `INSERT OR IGNORE INTO users (uid, username, display_name, email, slot) VALUES (?, ?, ?, ?, ?)`,
  ).run(a.uid, username, a.displayName, a.email, a.slot);
}

const seedCount = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
if (seedCount === 0) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, type, text, reactions, status, created_at, read_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('1', CONVERSATION_ID, 'user-partner', 'text', 'Hey love. Welcome to 1216.', '[]', 'seen', now - 3600000, JSON.stringify(['user-ayush', 'user-partner']));
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, type, text, reactions, status, created_at, read_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run('2', CONVERSATION_ID, 'user-ayush', 'text', 'Our private space on the web.', '[]', 'seen', now - 1800000, JSON.stringify(['user-ayush', 'user-partner']));
}

function signToken(uid, slot) {
  const payload = { uid, slot, exp: Date.now() + 30 * 86400000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHash('sha256').update(`${data}.${JWT_SECRET}`).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = createHash('sha256').update(`${data}.${JWT_SECRET}`).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function rowToMessage(row) {
  const reactions = JSON.parse(row.reactions ?? '[]').map((r) =>
    r.type ? r : { type: r.emoji === '❤️' ? 'heart' : 'like', userId: r.userId },
  );
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    type: row.type,
    text: row.text ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaThumbnail: row.media_thumbnail ?? undefined,
    replyToId: row.reply_to_id ?? undefined,
    replyToPreview: row.reply_to_preview ?? undefined,
    reactions,
    status: row.status,
    viewOnce: !!row.view_once,
    viewedBy: JSON.parse(row.viewed_by ?? '[]'),
    editedAt: row.edited_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    createdAt: row.created_at,
    readBy: JSON.parse(row.read_by ?? '[]'),
  };
}

function rowToCall(row) {
  return {
    id: row.id,
    callerId: row.caller_id,
    calleeId: row.callee_id,
    type: row.type,
    status: row.status,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    duration: row.duration ?? undefined,
  };
}

const wsClients = new Map();

function broadcastAll(type, data) {
  const msg = JSON.stringify({ type, data });
  for (const [, ws] of wsClients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: join(__dirname, 'uploads'),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${randomBytes(4).toString('hex')}${extname(file.originalname) || '.jpg'}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const auth = verifyToken(header.slice(7));
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  req.auth = auth;
  next();
}

app.post('/auth/login', (req, res) => {
  const { username, password, slot: bodySlot } = req.body;
  const key = Object.keys(ACCOUNTS).find((k) => k.toLowerCase() === String(username).trim().toLowerCase());
  if (!key || password !== ACCOUNTS[key].password) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const account = ACCOUNTS[key];
  const slot = bodySlot ?? account.slot;
  const token = signToken(account.uid, slot);
  res.json({
    token,
    user: { uid: account.uid, username: key, displayName: account.displayName, email: account.email },
    expiresAt: Date.now() + 30 * 86400000,
  });
});

app.get('/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(req.auth.uid);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    token: signToken(req.auth.uid, req.auth.slot),
    user: { uid: user.uid, username: user.username, displayName: user.display_name, email: user.email },
    expiresAt: Date.now() + 30 * 86400000,
  });
});

app.get('/users/partner/:uid', authMiddleware, (req, res) => {
  const partnerUid = req.params.uid === 'user-ayush' ? 'user-partner' : 'user-ayush';
  const user = db.prepare('SELECT * FROM users WHERE uid = ?').get(partnerUid);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({
    uid: user.uid,
    email: user.email,
    displayName: user.display_name,
    isOnline: wsClients.has(user.uid),
    lastSeen: Date.now(),
    createdAt: Date.now(),
  });
});

app.get('/conversations/:id/messages', authMiddleware, (req, res) => {
  const excludeSnap = req.query.channel === 'chat';
  const rows = excludeSnap
    ? db.prepare(
        `SELECT * FROM messages WHERE conversation_id = ? AND deleted_at IS NULL AND type != 'snap' ORDER BY created_at ASC`,
      ).all(req.params.id)
    : db.prepare(
        `SELECT * FROM messages WHERE conversation_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
      ).all(req.params.id);
  res.json(rows.map(rowToMessage));
});

app.get('/snaps', authMiddleware, (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM messages WHERE type = 'snap' AND deleted_at IS NULL ORDER BY created_at DESC`,
  ).all();
  res.json(rows.map(rowToMessage));
});

app.post('/conversations/:id/messages', authMiddleware, (req, res) => {
  const id = req.body.type === 'snap' ? `snap-${Date.now()}-${randomBytes(3).toString('hex')}` : `m-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const { senderId, type = 'text', text, mediaUrl, mediaThumbnail, replyToId, replyToPreview, viewOnce } = req.body;
  const createdAt = Date.now();
  const isViewOnce = viewOnce || type === 'snap';
  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_id, type, text, media_url, media_thumbnail, reply_to_id, reply_to_preview, created_at, read_by, view_once, viewed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.params.id, senderId, type, text ?? null, mediaUrl ?? null, mediaThumbnail ?? null, replyToId ?? null, replyToPreview ?? null, createdAt, JSON.stringify([senderId]), isViewOnce ? 1 : 0, '[]');
  const msg = rowToMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(id));
  broadcastAll('message:new', msg);
  res.status(201).json(msg);
});

app.post('/messages/:id/view', authMiddleware, (req, res) => {
  const { userId } = req.body;
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const viewedBy = JSON.parse(row.viewed_by ?? '[]');
  if (!viewedBy.includes(userId)) viewedBy.push(userId);
  db.prepare('UPDATE messages SET viewed_by = ? WHERE id = ?').run(JSON.stringify(viewedBy), req.params.id);
  const msg = rowToMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id));
  broadcastAll('message:update', msg);
  res.json(msg);
});

app.patch('/messages/:id', authMiddleware, (req, res) => {
  const { text } = req.body;
  db.prepare('UPDATE messages SET text = ?, edited_at = ? WHERE id = ?').run(text, Date.now(), req.params.id);
  const msg = rowToMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id));
  broadcastAll('message:update', msg);
  res.json(msg);
});

app.delete('/messages/:id', authMiddleware, (req, res) => {
  db.prepare('UPDATE messages SET deleted_at = ?, text = ? WHERE id = ?').run(Date.now(), '', req.params.id);
  broadcastAll('message:delete', { id: req.params.id });
  res.json({ ok: true });
});

app.post('/messages/:id/reactions', authMiddleware, (req, res) => {
  const { type, userId } = req.body;
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const reactions = JSON.parse(row.reactions ?? '[]').filter((r) => r.userId !== userId);
  reactions.push({ type, userId });
  db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), req.params.id);
  const msg = rowToMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id));
  broadcastAll('message:update', msg);
  res.json(msg);
});

app.post('/media/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const path = `/uploads/${req.file.filename}`;
  res.json({ url: path });
});

app.post('/calls', authMiddleware, (req, res) => {
  const id = `call-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const { callerId, calleeId, type, status = 'ringing', startedAt = Date.now() } = req.body;
  db.prepare(
    `INSERT INTO calls (id, caller_id, callee_id, type, status, started_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, callerId, calleeId, type, status, startedAt);
  const call = rowToCall(db.prepare('SELECT * FROM calls WHERE id = ?').get(id));
  broadcastAll('call:update', call);
  res.status(201).json({ id });
});

app.patch('/calls/:id', authMiddleware, (req, res) => {
  const { status, endedAt } = req.body;
  const row = db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const startedAt = row.started_at ?? Date.now();
  const duration = endedAt ? Math.floor((endedAt - startedAt) / 1000) : null;
  db.prepare(
    `UPDATE calls SET status = ?, ended_at = ?, duration = ? WHERE id = ?`,
  ).run(status, endedAt ?? null, duration, req.params.id);
  const call = rowToCall(db.prepare('SELECT * FROM calls WHERE id = ?').get(req.params.id));
  broadcastAll('call:update', call);
  res.json({ ok: true });
});

app.get('/calls/incoming/:userId', authMiddleware, (req, res) => {
  const row = db.prepare(
    `SELECT * FROM calls WHERE callee_id = ? AND status = 'ringing' ORDER BY started_at DESC LIMIT 1`,
  ).get(req.params.userId);
  res.json(row ? rowToCall(row) : null);
});

app.get('/calls/history/:userId', authMiddleware, (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM calls WHERE caller_id = ? OR callee_id = ? ORDER BY started_at DESC`,
  ).all(req.params.userId, req.params.userId);
  res.json(rows.map(rowToCall));
});

app.post('/calls/signals', authMiddleware, (req, res) => {
  const id = `sig-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const { callId, from, to, type, payload, createdAt = Date.now() } = req.body;
  db.prepare(
    `INSERT INTO call_signals (id, call_id, from_id, to_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, callId, from, to, type, payload, createdAt);
  broadcastAll('signal:new', { callId, to });
  res.status(201).json({ id });
});

app.get('/calls/signals', authMiddleware, (req, res) => {
  const { callId, to, since = '0' } = req.query;
  const rows = db.prepare(
    `SELECT * FROM call_signals WHERE call_id = ? AND to_id = ? AND created_at > ? ORDER BY created_at ASC`,
  ).all(callId, to, Number(since));
  res.json(rows.map((r) => ({
    id: r.id,
    callId: r.call_id,
    from: r.from_id,
    to: r.to_id,
    type: r.type,
    payload: r.payload,
    createdAt: r.created_at,
  })));
});

app.delete('/calls/signals/:callId', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM call_signals WHERE call_id = ?').run(req.params.callId);
  res.json({ ok: true });
});

app.get('/stats', authMiddleware, (req, res) => {
  const totalMessages = db.prepare('SELECT COUNT(*) as c FROM messages WHERE deleted_at IS NULL').get().c;
  const totalCalls = db.prepare('SELECT COUNT(*) as c FROM calls').get().c;
  res.json({ totalMessages, totalCalls, totalMemories: 0 });
});

app.get('/health', (_req, res) => res.json({ ok: true, db: 'sqlite' }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');
  const auth = token ? verifyToken(token) : null;
  if (!auth) {
    ws.close(4001, 'Unauthorized');
    return;
  }
  wsClients.set(auth.uid, ws);
  ws.on('close', () => wsClients.delete(auth.uid));
});

httpServer.listen(PORT, () => {
  console.log(`1216 API + SQLite running on http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});
