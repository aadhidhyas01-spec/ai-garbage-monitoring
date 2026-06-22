# CivicLens Edge Device (MVP)

Prototype edge client.

- Captures from a fixed camera (webcam for demo)
- Runs AI detection (stub in MVP)
- When trigger condition is met, sends alert to admin:
  - `POST /api/alerts-with-snapshot` with snapshot image

## Prerequisites
- Python 3.10+
- A camera device accessible by OpenCV

## Setup
```bash
cd cctv-device
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## Configure
Copy `.env.example` to `.env` and set:
- `ADMIN_URL` (e.g. http://localhost:3000)
- `ZONE_ID` (e.g. ZONE_1)

## Run (demo)
```bash
python edge_client.py
```

