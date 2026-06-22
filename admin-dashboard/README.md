# CivicLens Admin Dashboard (MVP - Lite)

This version avoids native SQLite dependencies (better-sqlite3) to work in environments without Visual Studio build tools.

## Prerequisites
- Node.js 18+

## Setup
```bash
cd admin-dashboard
npm install
```

## Configure
Create `.env`:
```env
PORT=3000
```

## Run
```bash
npm start
```

Dashboard: http://localhost:3000

## API
- `POST /api/alerts`
  - JSON body: `{ zoneId, confidence, eventType, timestamp?, meta? }`
- `POST /api/alerts-with-snapshot`
  - multipart/form-data with fields:
    - `zoneId` (string)
    - `confidence` (number)
    - `eventType` (string)
    - `timestamp` (optional)
    - `meta` (optional JSON string)
    - `snapshot` (file)
- `GET /api/alerts?limit=30`

## Storage
- Alerts are appended to `data/alerts.jsonl`.
- Snapshots are saved to `uploads/`.

