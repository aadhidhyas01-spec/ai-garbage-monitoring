import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import BetterSqlite3 from 'better-sqlite3';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Ensure uploads dir
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Static dashboard assets (served from public)
app.use(express.static(path.join(process.cwd(), 'public')));

// ---- DB ----
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data.sqlite');
const db = new BetterSqlite3(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zoneId TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    confidence REAL NOT NULL,
    eventType TEXT NOT NULL,
    snapshotPath TEXT,
    meta TEXT
  );
`);

function nowMs() {
  return Date.now();
}

// Receive alert metadata (no image)
app.post('/api/alerts', (req, res) => {
  const { zoneId, confidence, eventType, timestamp, meta } = req.body || {};

  if (!zoneId || typeof confidence !== 'number' || !eventType) {
    return res.status(400).json({ error: 'Missing zoneId, confidence(number), or eventType.' });
  }

  const ts = typeof timestamp === 'number' ? timestamp : nowMs();
  const stmt = db.prepare(
    'INSERT INTO alerts (zoneId, timestamp, confidence, eventType, snapshotPath, meta) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(zoneId, ts, confidence, eventType, null, meta ? JSON.stringify(meta) : null);
  res.json({ ok: true, id: info.lastInsertRowid });
});

// Receive alert with snapshot upload
app.post('/api/alerts-with-snapshot', upload.single('snapshot'), (req, res) => {
  const { zoneId, confidence, eventType, timestamp, meta } = req.body || {};

  if (!req.file) {
    return res.status(400).json({ error: 'snapshot file missing (field name: snapshot).' });
  }
  if (!zoneId || !eventType || typeof confidence === 'undefined') {
    return res.status(400).json({ error: 'Missing zoneId, confidence, or eventType.' });
  }

  const confNum = Number(confidence);
  if (!Number.isFinite(confNum)) {
    return res.status(400).json({ error: 'confidence must be a number.' });
  }

  const tsNum = timestamp ? Number(timestamp) : nowMs();

  // Keep file name stable and predictable
  const ext = path.extname(req.file.originalname) || '.jpg';
  const safeName = `alert_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
  const finalPath = path.join(uploadsDir, safeName);
  fs.renameSync(req.file.path, finalPath);

  const stmt = db.prepare(
    'INSERT INTO alerts (zoneId, timestamp, confidence, eventType, snapshotPath, meta) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const info = stmt.run(
    String(zoneId),
    Number(tsNum),
    confNum,
    String(eventType),
    path.join('uploads', safeName).replaceAll('\\', '/'),
    meta ? JSON.stringify(meta) : null
  );

  res.json({ ok: true, id: info.lastInsertRowid });
});

app.get('/api/alerts', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 30), 200);
  const rows = db
    .prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?')
    .all(limit);

  const mapped = rows.map((r) => ({
    id: r.id,
    zoneId: r.zoneId,
    timestamp: r.timestamp,
    confidence: r.confidence,
    eventType: r.eventType,
    snapshotUrl: r.snapshotPath ? `/${r.snapshotPath}` : null,
    meta: r.meta ? JSON.parse(r.meta) : null
  }));

  res.json({ ok: true, alerts: mapped });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`CivicLens admin running on http://localhost:${port}`);
});

