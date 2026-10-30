# CivicLens Edge Camera Prototype

A Python edge-client prototype for sending civic incident alerts to the CivicLens admin dashboard.

## Current behaviour

- `MOCK_CAMERA=true` (default): generates synthetic mock incidents and sends metadata-only alerts.
- `MOCK_CAMERA=false`: opens a physical webcam and uses a simple brightness-threshold heuristic to trigger a trash-accumulation alert.
- The physical-camera path captures and uploads a JPEG snapshot to `POST /api/alerts-with-snapshot`.

**This is not a trained AI detector.** The physical-camera heuristic is a placeholder and must be replaced and validated before real-world use.

## Setup

```cmd
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Configure `ADMIN_URL`, `ZONE_ID`, `ALERT_DEBOUNCE_SECONDS` and `MOCK_CAMERA` in `.env`.

Run the simulator:

```cmd
python edge_client.py
```

Press Ctrl+C to stop. For camera mode, set `MOCK_CAMERA=false` and ensure a working webcam is connected.
