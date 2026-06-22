# CivicLens AI (MVP)

This repo is being generated for **CivicLens**: a fixed camera + edge AI that notifies HQ/admin when a detected person is in a restricted/monitored area.

## What to expect (MVP)
- **Edge client**: captures from a fixed camera, runs detection (stub initially), and when an alert condition triggers:
  - sends an alert JSON to the admin server
  - uploads a snapshot image
- **Admin server**: receives alerts, stores them in SQLite, and exposes a simple dashboard UI.

## Run (after dependencies)
See `admin-dashboard/README.md` and `cctv-device/README.md`.

