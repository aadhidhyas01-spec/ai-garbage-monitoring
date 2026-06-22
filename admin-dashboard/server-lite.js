import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

// Upgraded CivicLens backend server
// Alerts stored in data/db.json to support status and assignments

dotenv.config({ path: path.join(process.cwd(), '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Ensure uploads dir
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Static assets
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/uploads', express.static(uploadsDir));

const dataDir = path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const defaultEmployees = [
  { id: 'emp_1', name: 'Arjun Kumar', role: 'Sanitation Officer', zone: 'ZONE_A', status: 'Active', phone: '+91 98765 43210', email: 'arjun@civiclens.local', password: 'password123' },
  { id: 'emp_2', name: 'Priya Sharma', role: 'Safety Inspector', zone: 'ZONE_B', status: 'Active', phone: '+91 98765 43211', email: 'priya@civiclens.local', password: 'password123' },
  { id: 'emp_3', name: 'Vikram Singh', role: 'Maintenance Engineer', zone: 'ZONE_C', status: 'Active', phone: '+91 98765 43212', email: 'vikram@civiclens.local', password: 'password123' },
  { id: 'emp_4', name: 'Kavitha Ram', role: 'Waste Management Lead', zone: 'ZONE_A', status: 'Active', phone: '+91 98765 43213', email: 'kavitha@civiclens.local', password: 'password123' },
  { id: 'emp_5', name: 'Rohan Gupta', role: 'Civic Enforcement Officer', zone: 'ZONE_B', status: 'Active', phone: '+91 98765 43214', email: 'rohan@civiclens.local', password: 'password123' }
];

const dbFile = path.join(dataDir, 'db.json');

function readDb() {
  if (!fs.existsSync(dbFile)) {
    const initial = { alerts: [], employees: defaultEmployees };
    fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch (e) {
    return { alerts: [], employees: defaultEmployees };
  }
}

function writeDb(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
}

function nowMs() {
  return Date.now();
}

// Ingest Alert Metadata (no image)
app.post('/api/alerts', (req, res) => {
  const { zoneId, confidence, eventType, timestamp, meta } = req.body || {};

  if (!zoneId || typeof confidence !== 'number' || !eventType) {
    return res.status(400).json({ error: 'Missing zoneId, confidence(number), or eventType.' });
  }

  const ts = typeof timestamp === 'number' ? timestamp : nowMs();
  const db = readDb();
  
  let parsedMeta = null;
  if (meta) {
    try {
      parsedMeta = typeof meta === 'string' ? JSON.parse(meta) : meta;
    } catch (e) {
      parsedMeta = meta;
    }
  }

  const alert = {
    id: String(Date.now()) + '_' + Math.random().toString(16).slice(2),
    zoneId: String(zoneId),
    timestamp: ts,
    confidence,
    eventType: String(eventType),
    snapshotUrl: null,
    status: 'pending',
    assignedEmployee: null,
    instructions: null,
    dispatchedAt: null,
    resolutionNotes: null,
    resolvedAt: null,
    meta: parsedMeta
  };

  db.alerts.push(alert);
  writeDb(db);

  res.json({ ok: true, id: alert.id });
});

// Ingest Alert with Snapshot Upload
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

  const ext = path.extname(req.file.originalname) || '.jpg';
  const safeName = `alert_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
  const finalPath = path.join(uploadsDir, safeName);
  fs.renameSync(req.file.path, finalPath);

  let parsedMeta = null;
  if (meta) {
    try {
      parsedMeta = typeof meta === 'string' ? JSON.parse(meta) : meta;
    } catch (e) {
      parsedMeta = meta;
    }
  }

  const db = readDb();
  const alert = {
    id: String(Date.now()) + '_' + Math.random().toString(16).slice(2),
    zoneId: String(zoneId),
    timestamp: tsNum,
    confidence: confNum,
    eventType: String(eventType),
    snapshotUrl: `/uploads/${safeName}`,
    status: 'pending',
    assignedEmployee: null,
    instructions: null,
    dispatchedAt: null,
    resolutionNotes: null,
    resolvedAt: null,
    meta: parsedMeta
  };

  db.alerts.push(alert);
  writeDb(db);

  res.json({ ok: true, id: alert.id });
});

// Get Alerts
app.get('/api/alerts', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 30), 200);
  const db = readDb();
  const sorted = [...db.alerts].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  res.json({ ok: true, alerts: sorted.slice(0, limit) });
});

// Get Employees
app.get('/api/employees', (req, res) => {
  const db = readDb();
  // Don't send passwords to frontend
  const safeEmployees = (db.employees || defaultEmployees).map(e => {
    const { password, ...rest } = e;
    return rest;
  });
  res.json({ ok: true, employees: safeEmployees });
});

// Employee Login Endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const db = readDb();
  const employee = (db.employees || defaultEmployees).find(e => e.email === email && e.password === password);
  
  if (employee) {
    const { password: _, ...safeEmployee } = employee;
    res.json({ ok: true, employee: safeEmployee });
  } else {
    res.status(401).json({ ok: false, error: 'Invalid email or password' });
  }
});

// Assign Alert to Employee
app.post('/api/alerts/:id/assign', (req, res) => {
  const { id } = req.params;
  const { employeeId, instructions } = req.body || {};

  if (!employeeId || !instructions) {
    return res.status(400).json({ error: 'Missing employeeId or instructions.' });
  }

  const db = readDb();
  const idx = db.alerts.findIndex(a => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Alert not found.' });
  }

  const employee = db.employees.find(e => e.id === employeeId);
  if (!employee) {
    return res.status(404).json({ error: 'Employee not found.' });
  }

  db.alerts[idx].status = 'dispatched';
  db.alerts[idx].assignedEmployee = employee;
  db.alerts[idx].instructions = instructions;
  db.alerts[idx].dispatchedAt = nowMs();

  writeDb(db);
  res.json({ ok: true, alert: db.alerts[idx] });
});

// Resolve Alert
app.post('/api/alerts/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { resolutionNotes } = req.body || {};

  if (!resolutionNotes) {
    return res.status(400).json({ error: 'Missing resolutionNotes.' });
  }

  const db = readDb();
  const idx = db.alerts.findIndex(a => a.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Alert not found.' });
  }

  db.alerts[idx].status = 'resolved';
  db.alerts[idx].resolutionNotes = resolutionNotes;
  db.alerts[idx].resolvedAt = nowMs();

  writeDb(db);
  res.json({ ok: true, alert: db.alerts[idx] });
});

// Reset Database for demo
app.post('/api/alerts/reset', (req, res) => {
  const db = { alerts: [], employees: defaultEmployees };
  writeDb(db);
  res.json({ ok: true });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`CivicLens admin running on http://localhost:${port}`);
});

