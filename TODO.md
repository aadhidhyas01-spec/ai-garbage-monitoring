# CivicLens Camera Monitoring MVP — TODO

## Implemented
- [x] Express admin API and dashboard UI (MVP).
- [x] Supabase-backed alert and employee data.
- [x] Synthetic mock incident generator.
- [x] Webcam capture prototype.
- [x] Metadata-only demo alerts.
- [x] JPEG snapshot upload from physical-camera mode.

## Remaining before real deployment
- [ ] Replace brightness-threshold placeholder with a trained and validated vision model.
- [ ] Add authentication and role-based authorisation to dashboard management endpoints.
- [ ] Create employee accounts with scrypt password hashes; no default plaintext accounts.
- [ ] Review and enforce Supabase Row Level Security.
- [ ] Move snapshot storage to durable object storage.
- [ ] Restrict network exposure and CORS to approved origins.
- [ ] Test the complete edge-to-dashboard flow with a real camera and Supabase test project.
