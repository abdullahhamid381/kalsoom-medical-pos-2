import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { runSeed } from './seed';
import { runMigrations } from './migrate';

// ---------------------------------------------------------------------------
// Persistent local database connection.
//
// This opens a real .db file on disk (location controlled by DATABASE_PATH,
// defaults to ./data/kalsoom.db). better-sqlite3 writes to this file
// immediately and synchronously on every insert/update - there is no
// in-memory cache that disappears on restart. As long as the "data" folder
// is not deleted, every patient, doctor, user and appointment record
// persists permanently across server restarts, reboots, and redeploys.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __kalsoomDb: Database.Database | undefined;
}

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH || './data/kalsoom.db';
  const resolved = path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return resolved;
}

/** Resolves (and creates if missing) a subdirectory under the same data/ folder the SQLite db lives in. */
export function getUploadsDir(subdir: string): string {
  const dataDir = path.dirname(resolveDbPath());
  const dir = path.join(dataDir, 'uploads', subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function bootstrap(db: Database.Database) {
  const schemaPath = path.join(process.cwd(), 'lib', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  runMigrations(db);
  runSeed(db);
}

export function getDb(): Database.Database {
  if (!global.__kalsoomDb) {
    const dbPath = resolveDbPath();
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    bootstrap(db);
    global.__kalsoomDb = db;
  }
  return global.__kalsoomDb;
}

// Small helpers -------------------------------------------------------------

export function nowIso(): string {
  return new Date().toISOString();
}

/** Generates the next sequential, human readable appointment number for a given day, e.g. KMC-20260617-0001 */
export function nextAppointmentNo(db: Database.Database, dateStr: string): string {
  const compact = dateStr.replaceAll('-', '');
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM appointments WHERE appointment_date = ?`
    )
    .get(dateStr) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `KMC-${compact}-${seq}`;
}

/** Generates the next token number for a doctor on a given day (resets daily, used on the printed slip) */
export function nextTokenNumber(db: Database.Database, doctorId: number, dateStr: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'`
    )
    .get(doctorId, dateStr) as { c: number };
  return row.c + 1;
}

/** Generates a unique lab order number e.g. LAB-20260620-0003 */export function nextOrderNo(db: Database.Database, dateStr: string): string {
  const compact = dateStr.replaceAll('-', '');
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM lab_orders WHERE created_at LIKE ?`)
    .get(`${dateStr}%`) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `LAB-${compact}-${seq}`;
}
/** Generates a unique lab sample id/barcode e.g. SMP-20260709-0001 */
export function nextSampleId(db: Database.Database, dateStr: string): string {
  const compact = dateStr.replaceAll('-', '');
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM lab_samples WHERE created_at LIKE ?`)
    .get(`${dateStr}%`) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `SMP-${compact}-${seq}`;
}
export function nextSaleNo(db: Database.Database, dateStr: string): string {
  const compact = dateStr.replaceAll('-', '');
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM pharmacy_sales WHERE created_at LIKE ?`)
    .get(`${dateStr}%`) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `PHM-${compact}-${seq}`;
}

export function getSetting(key: string, fallback = ''): string {
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

/** Generates a unique admission number e.g. IPD-20260621-0001 */
export function nextAdmissionNo(db: Database.Database, dateStr: string): string {
  const compact = dateStr.replaceAll('-', '');
  const row = db.prepare(`SELECT COUNT(*) AS c FROM admissions WHERE admission_date = ?`).get(dateStr) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `IPD-${compact}-${seq}`;
}

/** Generates a unique surgery record number e.g. SRG-20260623-0001 */
export function nextSurgeryNo(db: Database.Database, dateStr: string): string {
  const compact = dateStr.replaceAll('-', '');
  const row = db.prepare(`SELECT COUNT(*) AS c FROM surgery_records WHERE surgery_date = ?`).get(dateStr) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `SRG-${compact}-${seq}`;
}

/** Generates a unique purchase order number e.g. PO-20260623-0001 */
export function nextPoNo(db: Database.Database, dateStr: string): string {
  const compact = dateStr.replaceAll('-', '');
  const row = db.prepare(`SELECT COUNT(*) AS c FROM purchase_orders WHERE created_at LIKE ?`).get(`${dateStr}%`) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `PO-${compact}-${seq}`;
}

/** Generates a unique purchase-return number e.g. PRET-20260623-0001 */
export function nextPurchaseReturnNo(db: Database.Database, dateStr: string): string {
  const compact = dateStr.replaceAll('-', '');
  const row = db.prepare(`SELECT COUNT(*) AS c FROM purchase_returns WHERE created_at LIKE ?`).get(`${dateStr}%`) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `PRET-${compact}-${seq}`;
}

/** Generates a unique sale-return number e.g. RET-20260623-0001 */
export function nextSaleReturnNo(db: Database.Database, dateStr: string): string {
  const compact = dateStr.replaceAll('-', '');
  const row = db.prepare(`SELECT COUNT(*) AS c FROM pharmacy_sale_returns WHERE created_at LIKE ?`).get(`${dateStr}%`) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `RET-${compact}-${seq}`;
}
