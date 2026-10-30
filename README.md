# CivicLens AI — Civic Incident Monitoring Prototype

This repository contains an **early fixed-camera monitoring prototype** and a small admin dashboard. It is separate from the CivicLens autonomous waste-collection truck simulation and should not be described as a completed AI vision product.

## Current implementation status

- The edge client defaults to **mock mode** (`MOCK_CAMERA=true`) and generates synthetic demo incidents.
- With `MOCK_CAMERA=false`, it opens a physical webcam and runs a simple frame-brightness heuristic.
- The current physical-camera detector is a **placeholder heuristic**, not YOLO, a trained model or a reliable person/waste detector.
- The physical-camera path now posts a JPEG snapshot to `/api/alerts-with-snapshot`; mock mode posts metadata-only demo alerts.
- The dashboard server in `admin-dashboard/server-lite.js` uses Supabase for alert and employee records and stores received snapshots in its local `uploads/` directory.

## Repository layout

```text
admin-dashboard/
  server-lite.js       Active Express + Supabase server (npm start)
  public/              Dashboard and employee UI
  README.md            Dashboard setup and API notes
cctv-device/
  edge_client.py       Mock simulator and webcam prototype
  requirements.txt     OpenCV, NumPy, Requests and python-dotenv
  .env.example         Edge client configuration template
```

The older `admin-dashboard/server.js` SQLite server was an unused alternative; the package start script uses `server-lite.js`.

## Run the admin dashboard

Prerequisites: Node.js 18+ and a Supabase project with the required `alerts` and `employees` tables.

```cmd
cd admin-dashboard
npm install
copy .env.example .env
```

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `PORT` in `.env`, then run:

```cmd
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Run the edge client

Prerequisites: Python 3.10+.

```cmd
cd cctv-device
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Set `ADMIN_URL`, `ZONE_ID`, `ALERT_DEBOUNCE_SECONDS` and `MOCK_CAMERA` in `.env`.

For synthetic dashboard data, leave `MOCK_CAMERA=true` and run:

```cmd
python edge_client.py
```

For a physical webcam, set `MOCK_CAMERA=false`. The current detector is only a brightness threshold heuristic; it must be replaced with a validated computer-vision model before treating alerts as real detections.

## API

- `POST /api/alerts` — metadata-only alert.
- `POST /api/alerts-with-snapshot` — multipart alert with `snapshot` JPEG.
- `GET /api/alerts?limit=30` — recent alerts.

## Important limitations

- There is no trained AI model or production detection logic in this MVP.
- Employee accounts must be created and stored with a scrypt password hash in `employees.password_hash`; no default demo accounts are created.
- The dashboard is a development prototype. Add authenticated/authorised management endpoints, strict Supabase Row Level Security, restricted network access and persistent object storage before deployment.
- Snapshot files are stored on the dashboard server's local disk. They may be lost when the host restarts or redeploys.

