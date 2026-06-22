import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';

// Upgraded CivicLens backend server with Supabase integration

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

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const defaultEmployees = [
  { id: 'emp_1', name: 'Arjun Kumar', role: 'Sanitation Officer', zone: 'ZONE_A', status: 'Active', phone: '+91 98765 43210', email: 'arjun@civiclens.local', password: 'password123' },
  { id: 'emp_2', name: 'Priya Sharma', role: 'Safety Inspector', zone: 'ZONE_B', status: 'Active', phone: '+91 98765 43211', email: 'priya@civiclens.local', password: 'password123' },
  { id: 'emp_3', name: 'Vikram Singh', role: 'Maintenance Engineer', zone: 'ZONE_C', status: 'Active', phone: '+91 98765 43212', email: 'vikram@civiclens.local', password: 'password123' },
  { id: 'emp_4', name: 'Kavitha Ram', role: 'Waste Management Lead', zone: 'ZONE_A', status: 'Active', phone: '+91 98765 43213', email: 'kavitha@civiclens.local', password: 'password123' },
  { id: 'emp_5', name: 'Rohan Gupta', role: 'Civic Enforcement Officer', zone: 'ZONE_B', status: 'Active', phone: '+91 98765 43214', email: 'rohan@civiclens.local', password: 'password123' }
];

// Seed default employees if none exist
async function seedEmployeesIfNeeded() {
  try {
    const { data: existing, error } = await supabase
      .from('employees')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Error checking employees in Supabase:', error);
      return;
    }

    if (!existing || existing.length === 0) {
      console.log('Employees table is empty. Seeding default employees...');
      const { error: insertError } = await supabase
        .from('employees')
        .insert(defaultEmployees);

      if (insertError) {
        console.error('Error seeding default employees:', insertError);
      } else {
        console.log('Seeded employees successfully!');
      }
    } else {
      console.log('Employees table already has data. Skipping seed.');
    }
  } catch (err) {
    console.error('Unexpected error seeding employees:', err);
  }
}

seedEmployeesIfNeeded();

function nowMs() {
  return Date.now();
}

// Ingest Alert Metadata (no image)
app.post('/api/alerts', async (req, res) => {
  const { zoneId, confidence, eventType, timestamp, meta } = req.body || {};

  if (!zoneId || typeof confidence !== 'number' || !eventType) {
    return res.status(400).json({ error: 'Missing zoneId, confidence(number), or eventType.' });
  }

  const ts = typeof timestamp === 'number' ? timestamp : nowMs();
  
  let parsedMeta = null;
  if (meta) {
    try {
      parsedMeta = typeof meta === 'string' ? JSON.parse(meta) : meta;
    } catch (e) {
      parsedMeta = meta;
    }
  }

  const alertId = String(Date.now()) + '_' + Math.random().toString(16).slice(2);

  const { error } = await supabase
    .from('alerts')
    .insert({
      id: alertId,
      zoneId: String(zoneId),
      timestamp: ts,
      confidence,
      eventType: String(eventType),
      snapshotUrl: null,
      status: 'pending',
      instructions: null,
      dispatchedAt: null,
      resolutionNotes: null,
      resolvedAt: null,
      meta: parsedMeta
    });

  if (error) {
    console.error('Error inserting alert:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true, id: alertId });
});

// Ingest Alert with Snapshot Upload
app.post('/api/alerts-with-snapshot', upload.single('snapshot'), async (req, res) => {
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

  const alertId = String(Date.now()) + '_' + Math.random().toString(16).slice(2);

  const { error } = await supabase
    .from('alerts')
    .insert({
      id: alertId,
      zoneId: String(zoneId),
      timestamp: tsNum,
      confidence: confNum,
      eventType: String(eventType),
      snapshotUrl: `/uploads/${safeName}`,
      status: 'pending',
      instructions: null,
      dispatchedAt: null,
      resolutionNotes: null,
      resolvedAt: null,
      meta: parsedMeta
    });

  if (error) {
    console.error('Error inserting alert with snapshot:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true, id: alertId });
});

// Get Alerts
app.get('/api/alerts', async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 30), 200);

  const { data, error } = await supabase
    .from('alerts')
    .select('*, employees(*)')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching alerts from Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  // Map to match the frontend expected key 'assignedEmployee'
  const formattedAlerts = data.map(a => {
    const { employees, assigned_employee_id, ...rest } = a;
    return {
      ...rest,
      assignedEmployee: employees || null
    };
  });

  res.json({ ok: true, alerts: formattedAlerts });
});

// Get Employees
app.get('/api/employees', async (req, res) => {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, role, zone, status, phone, email');

  if (error) {
    console.error('Error fetching employees from Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true, employees: data });
});

// Employee Login Endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Missing email or password' });
  }

  const { data, error } = await supabase
    .from('employees')
    .select('id, name, role, zone, status, phone, email')
    .eq('email', email)
    .eq('password', password)
    .maybeSingle();

  if (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }

  if (data) {
    res.json({ ok: true, employee: data });
  } else {
    res.status(401).json({ ok: false, error: 'Invalid email or password' });
  }
});

// Assign Alert to Employee
app.post('/api/alerts/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { employeeId, instructions } = req.body || {};

  if (!employeeId || !instructions) {
    return res.status(400).json({ error: 'Missing employeeId or instructions.' });
  }

  // Check if employee exists
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .maybeSingle();

  if (empError) {
    console.error('Error fetching employee for assignment:', empError);
    return res.status(500).json({ error: empError.message });
  }

  if (!employee) {
    return res.status(404).json({ error: 'Employee not found.' });
  }

  // Update alert
  const { data: updatedAlerts, error: updateError } = await supabase
    .from('alerts')
    .update({
      status: 'dispatched',
      assigned_employee_id: employeeId,
      instructions: instructions,
      dispatchedAt: nowMs()
    })
    .eq('id', id)
    .select('*, employees(*)');

  if (updateError) {
    console.error('Error updating alert assignment:', updateError);
    return res.status(500).json({ error: updateError.message });
  }

  if (!updatedAlerts || updatedAlerts.length === 0) {
    return res.status(404).json({ error: 'Alert not found.' });
  }

  const a = updatedAlerts[0];
  const { employees, assigned_employee_id, ...rest } = a;
  const formattedAlert = {
    ...rest,
    assignedEmployee: employees || null
  };

  res.json({ ok: true, alert: formattedAlert });
});

// Resolve Alert
app.post('/api/alerts/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { resolutionNotes } = req.body || {};

  if (!resolutionNotes) {
    return res.status(400).json({ error: 'Missing resolutionNotes.' });
  }

  const { data: updatedAlerts, error: updateError } = await supabase
    .from('alerts')
    .update({
      status: 'resolved',
      resolutionNotes: resolutionNotes,
      resolvedAt: nowMs()
    })
    .eq('id', id)
    .select('*, employees(*)');

  if (updateError) {
    console.error('Error resolving alert:', updateError);
    return res.status(500).json({ error: updateError.message });
  }

  if (!updatedAlerts || updatedAlerts.length === 0) {
    return res.status(404).json({ error: 'Alert not found.' });
  }

  const a = updatedAlerts[0];
  const { employees, assigned_employee_id, ...rest } = a;
  const formattedAlert = {
    ...rest,
    assignedEmployee: employees || null
  };

  res.json({ ok: true, alert: formattedAlert });
});

// Reset Database for demo
app.post('/api/alerts/reset', async (req, res) => {
  try {
    // Delete all alerts
    const { error: delAlertsError } = await supabase
      .from('alerts')
      .delete()
      .neq('id', '');

    if (delAlertsError) {
      console.error('Error resetting alerts:', delAlertsError);
      return res.status(500).json({ error: delAlertsError.message });
    }

    // Delete all employees
    const { error: delEmployeesError } = await supabase
      .from('employees')
      .delete()
      .neq('id', '');

    if (delEmployeesError) {
      console.error('Error resetting employees:', delEmployeesError);
      return res.status(500).json({ error: delEmployeesError.message });
    }

    // Re-seed employees
    const { error: insertError } = await supabase
      .from('employees')
      .insert(defaultEmployees);

    if (insertError) {
      console.error('Error re-seeding employees:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error resetting database:', err);
    res.status(500).json({ error: err.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`CivicLens admin running on http://localhost:${port}`);
});
