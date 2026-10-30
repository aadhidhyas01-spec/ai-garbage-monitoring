# CivicLens Admin Dashboard (MVP)

The active server is `server-lite.js`, launched by the `start` script in `package.json`. It uses Express, Supabase and Multer; it does **not** use the older SQLite `server.js`.

## Requirements

- Node.js 18+
- Supabase project with `alerts` and `employees` tables
- A Supabase anon key with appropriately restricted Row Level Security

## Setup

```cmd
npm install
copy .env.example .env
```

Set these values in `.env`:

```env
PORT=3000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
```

Run the server:

```cmd
npm start
```

Dashboard: [http://localhost:3000](http://localhost:3000)

## API

- `POST /api/alerts` — JSON metadata-only alert.
- `POST /api/alerts-with-snapshot` — multipart alert with `zoneId`, `confidence`, `eventType`, optional `timestamp` / `meta` and a `snapshot` JPEG.
- `GET /api/alerts?limit=30` — recent alerts.

Run `database/employee-password-hash.sql` in the Supabase SQL Editor to add the `password_hash` column. Existing accounts that still use a plaintext `password` column will not be able to log in until you generate and store a scrypt hash in `salt:hex` format. After migrating every account, drop the old plaintext column. The login endpoint verifies scrypt hashes and never returns them to the browser.

Example hash generation using Node.js:

```bash
node --input-type=module -e "import { randomBytes, scryptSync } from 'node:crypto'; const password = process.argv[1]; const salt = randomBytes(16).toString('hex'); console.log(salt + ':' + scryptSync(password, salt, 64).toString('hex'));" "change-this-password"
```

## Storage

- Alert records are stored in Supabase.
- Snapshot files are saved to the local `uploads/` folder and their relative path is stored in Supabase.
- Local uploads are not durable storage on ephemeral hosting platforms.

## Security warning

This is a development prototype, not a production-ready employee-management system. Management routes still need full authentication and authorisation, the Supabase anon key requires restrictive RLS policies, and the service must be exposed only on a trusted network until those controls are implemented.
