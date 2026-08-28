# Kalsoom Medical Complex — Appointment Booking POS

A complete receptionist desk / appointment booking system for Kalsoom Medical Complex, Bhakkar. Receptionists book doctor appointments for patients, payments are recorded (Cash, JazzCash, EasyPaisa, Bank Transfer, Card), every booking generates a professional PDF appointment slip with a scannable barcode, and the slip + a confirmation message can be sent straight to the patient's WhatsApp. A Super Admin manages doctors, staff accounts, and views revenue reports.

**This is a Node.js / Next.js application, not a PHP/Laravel project.** It does not run on XAMPP. It runs with Node.js directly (instructions below) — flagging this clearly since it's a different stack from typical XAMPP/PHP setups.

## What's inside

- **Permanent data storage**: a Postgres database (e.g. [Neon](https://neon.tech)), connected via `DATABASE_URL`. Nothing is in-memory or temporary — appointments, patients, doctors and users persist across restarts, deployments, and reboots. A managed Postgres provider handles backups for you.
- **Roles**: only the clinic owner runs the one-time seed script to create the first **Super Admin**. The Super Admin then creates **Receptionist** accounts from inside the app. Every appointment records exactly which logged-in user booked it.
- **Booking flow**: search an existing patient or register a new one inline, pick a doctor (fee auto-fills), set date/time, record payment method + amount + discount + amount paid, and the system computes Paid / Partial / Unpaid automatically.
- **PDF slip + barcode**: every appointment gets a navy-and-crimson branded PDF (`lib/pdf.ts`) with full patient/doctor details and a Code128 barcode of its unique appointment number — downloadable any time from the appointment page.
- **WhatsApp sending**: every appointment has a "Send via WhatsApp" button. See the WhatsApp section below for how automatic sending works and the always-available manual fallback.
- **Reports**: date-range revenue totals, breakdowns by payment method, doctor, staff member, and status.

## Requirements

- [Node.js](https://nodejs.org) version 18 or 20 LTS (Node 22 also works) installed on the machine that will run the server.
- npm (comes with Node.js).
- Internet access the first time you run `npm install` (to download packages and, optionally, the WhatsApp browser engine).

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.example .env
# Open .env and at minimum set DATABASE_URL to your Postgres connection
# string (e.g. from Neon), and change JWT_SECRET to a long random string.
# Review SUPER_ADMIN_USERNAME / SUPER_ADMIN_PASSWORD - this becomes your
# first login. You can change the password later from inside the app.

# 3. Create the database tables and the first Super Admin account
npm run seed

# 4. Start the app
npm run dev
# Open http://localhost:3000 and log in with the SUPER_ADMIN_USERNAME /
# SUPER_ADMIN_PASSWORD you set in .env (defaults: admin / Admin@12345)
```

For a production-style run instead of `npm run dev`:

```bash
npm run build
npm start
```

The server listens on port 3000 by default. To use a different port: `PORT=4000 npm start`.

`npm run seed` is optional and safe to run again later — the app also runs this same bootstrap automatically the first time it starts (so on Railway or any fresh deploy, you don't need to run it manually at all), but running it locally first is a convenient way to see the admin credentials printed in your terminal before you even start the server.

## Creating receptionist accounts

Only a Super Admin can create users. Log in as the Super Admin, go to **Dashboard → Staff Users → Add User**, and create a Receptionist account for each front-desk staff member. Receptionists can book appointments, manage patients, and view reports, but cannot manage doctors, other users, or settings.

## WhatsApp sending — how it works

Every appointment's detail page has a **Send via WhatsApp** button. There are two layers, so the feature always works one way or another:

1. **Automatic sending** (optional): the app can drive a real WhatsApp Web session (via the `whatsapp-web.js` library) to send the PDF and a confirmation message straight to the patient's number, no manual steps. To turn this on:
   - Make sure `WHATSAPP_ENABLED=true` in `.env` (it is by default).
   - Run `npm install` with internet access — this downloads a Chromium browser the first time, which can take a few minutes.
   - Log in as Super Admin, open **Dashboard → Settings**, click **Connect WhatsApp**, and scan the QR code with the clinic's WhatsApp phone (WhatsApp app → Linked Devices → Link a Device).
   - The session is saved to a `.wwebjs_auth` folder so you only scan once. Keep the server process running for sending to keep working.
   - **Honesty about this method**: this uses an unofficial automation library, not Meta's paid WhatsApp Business API. It works reliably for normal clinic volumes but carries a small risk of the number being temporarily restricted if used for very high message volume. It also requires the device running the server to stay online.

2. **Manual fallback (always available, no setup needed)**: whether or not automatic sending is connected, clicking **Send via WhatsApp** also gives a "Open WhatsApp Chat" link that opens WhatsApp with the confirmation message already typed, addressed to the patient's number. Staff can also use **Download PDF** to grab the slip and attach it to that chat manually. This always works, with zero configuration, even if you never touch the WhatsApp settings at all.

If you'd rather not deal with WhatsApp automation at all, just leave `WHATSAPP_ENABLED=true` and ignore the Settings page — the manual link covers every booking.

## Deploying to Railway

This app is built to run as a normal persistent server, so it's a good fit for [Railway](https://railway.app) — unlike serverless platforms (e.g. Vercel), Railway keeps your container running, which the WhatsApp login session needs (it still benefits from a persistent disk even though the database itself is now external Postgres).

1. **Create a new Railway project** from this repository (push it to GitHub first, then "New Project → Deploy from GitHub repo" in Railway). Railway will detect the included `Dockerfile` and build from it automatically — this also makes sure Chromium's system dependencies are installed correctly for WhatsApp automation.
2. **Add a Volume** to the service (Railway dashboard → your service → "Volumes" → "Add Volume") and mount it at `/data`, so the WhatsApp login session survives redeploys.
3. **Set environment variables** on the service (same names as `.env.example`):
   ```
   DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
   WWEBJS_DATA_PATH=/data/.wwebjs_auth
   ```
   `DATABASE_URL` can point at Neon, Railway's own Postgres plugin, Supabase, or any standard Postgres. Also set `JWT_SECRET`, `SUPER_ADMIN_NAME`, `SUPER_ADMIN_USERNAME`, `SUPER_ADMIN_PASSWORD`, the `CLINIC_*` values, and `WHATSAPP_ENABLED`.
4. **Deploy.** On first boot, the app automatically creates the database tables, the Super Admin account, and sample doctors — there's no separate setup command to run.
5. Open the `*.up.railway.app` URL Railway gives you and log in with your `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD`.
6. For WhatsApp: log in as Super Admin, go to **Settings**, click **Connect WhatsApp**, and scan the QR code. Because the session now lives on the volume, it survives future redeploys — you won't need to re-scan unless you explicitly disconnect or delete the volume.

Since the database is external Postgres (not a local file), this service can safely run multiple instances/replicas if you ever need to — unlike the old single-file-on-a-volume setup.

## Backing up your data

Your data lives in whatever Postgres provider `DATABASE_URL` points at. Most providers (Neon included) take automatic backups/point-in-time recovery — check your provider's dashboard. If you want your own manual backup, run `pg_dump "$DATABASE_URL" > backup.sql` from any machine with `pg_dump` installed.

## Project structure

```
app/
  api/                 Backend API routes (auth, appointments, patients, doctors, users, reports, whatsapp)
  dashboard/            All logged-in pages (overview, booking, lists, detail views, settings)
  login/                Login page
lib/
  db.ts                 Postgres connection (pg) + helpers (appointment numbers, token numbers)
  schema.pg.sql           Database schema (tables created on first run, never dropped)
  auth.ts                Password hashing + session/JWT handling
  pdf.ts                 PDF appointment slip generator
  barcode.ts             Barcode (Code128) generator
  whatsapp.ts             WhatsApp Web automation + manual share-link builder
  clinic.ts               Reads clinic name/address/phone from .env
components/              Shared UI (sidebar, topbar, patient search, status badges)
scripts/seed.js           One-time setup script (creates tables, super admin, sample doctors)
```

## Troubleshooting

- **"DATABASE_URL is not set" on startup**: add your Postgres connection string to `.env` as `DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require`. Neon, Railway's Postgres plugin, and Supabase all give you this string directly in their dashboard.
- **Connection errors on startup (`ECONNREFUSED`, SSL errors)**: double check `DATABASE_URL` — most managed Postgres providers require `?sslmode=require` in the connection string, and the host/port must be reachable from the machine running the app.
- **WhatsApp QR code never appears / Chromium download fails**: this needs internet access on the server machine the first time you `npm install`. If your network blocks it, automatic WhatsApp sending just won't be available — the manual "Open WhatsApp Chat" link still works for every appointment regardless.
- **Forgot the Super Admin password**: stop the server, edit `SUPER_ADMIN_PASSWORD` in `.env` to a new value, delete that admin's row from the `users` table (via your Postgres provider's SQL console, or any Postgres client), then run `npm run seed` again — or simpler, log in with another super admin account and reset the password from **Staff Users**.
