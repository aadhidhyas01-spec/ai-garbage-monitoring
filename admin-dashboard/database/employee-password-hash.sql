-- Run in the Supabase SQL Editor for the CivicLens demo dashboard.
-- The active server now reads employees.password_hash and never compares
-- a plaintext password stored in the database.

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- After you have securely migrated each existing employee account:
-- 1. Verify that password_hash is populated with "<salt-hex>:<scrypt-hash-hex>".
-- 2. Remove the old plaintext password column:
-- ALTER TABLE public.employees DROP COLUMN IF EXISTS password;

-- Do not insert the former demo password ("password123") into real accounts.
