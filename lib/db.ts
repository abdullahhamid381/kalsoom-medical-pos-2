import { Pool, PoolClient, types } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'fs';
import path from 'path';
import { runSeed } from './seed';

// pg returns BIGINT (e.g. COUNT(*)) as a string by default, to avoid silent precision loss
// for values beyond Number.MAX_SAFE_INTEGER. Every count/sum in this app is a small clinic-scale
// number, and the rest of the codebase does plain arithmetic on these (row.c + 1, row.c === 0),
// which breaks silently on strings ("0" + 1 === "01", "0" === 0 is false) - so parse them as
// real numbers globally instead of auditing every call site.
types.setTypeParser(20 /* int8/bigint */, (val: string) => parseInt(val, 10));

// ---------------------------------------------------------------------------
// Postgres (Neon) connection, wrapped in a thin compatibility layer that
// mirrors the better-sqlite3 API the rest of the app was written against:
// db.prepare(sql).get/all/run(...args), db.transaction(fn), db.exec(sql).
//
// This keeps every route handler's SQL text (still using '?' placeholders)
// unchanged - the shim rewrites '?' -> '$1,$2,...' and runs it through the
// pg driver. Every call is now async (real network I/O instead of a local
// file), so every call site does `await db.prepare(...).get(...)` etc.
//
// Transactions: db.transaction(fn) checks out one dedicated client from the
// pool, BEGINs, and uses AsyncLocalStorage to make every db.prepare(...)
// call made from inside fn (even indirectly, through awaited helpers)
// transparently run on that same client instead of a random pooled
// connection - so nested queries stay part of the same transaction without
// every call site needing to know about it.
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __kalsoomPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __kalsoomBootstrap: Promise<void> | undefined;
}

const txStorage = new AsyncLocalStorage<PoolClient>();

function getPool(): Pool {
  if (!global.__kalsoomPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Add it to your .env file (Postgres/Neon connection string).');
    }
    global.__kalsoomPool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return global.__kalsoomPool;
}

function currentExecutor(): Pool | PoolClient {
  return txStorage.getStore() || getPool();
}

/** Converts '?' positional placeholders (better-sqlite3 style) to Postgres '$1, $2, ...'. */
function toPgSql(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

class Statement {
  constructor(private sql: string) {}

  async get(...params: any[]): Promise<any> {
    const rows = await this.exec(params);
    return rows[0];
  }

  async all(...params: any[]): Promise<any[]> {
    return this.exec(params);
  }

  async run(...params: any[]): Promise<{ lastInsertRowid: number; changes: number }> {
    const tableMatch = this.sql.match(/^\s*INSERT\s+INTO\s+(\w+)/i);
    const isInsert = !!tableMatch;
    // `settings` has no `id` column (its PK is `key`) - every other table does.
    const canReturnId = isInsert && tableMatch![1] !== 'settings';
    let sql = toPgSql(this.sql);
    if (canReturnId && !/RETURNING/i.test(sql)) sql += ' RETURNING id';
    const res = await currentExecutor().query(sql, params);
    return { lastInsertRowid: res.rows[0]?.id ?? 0, changes: res.rowCount ?? 0 };
  }

  private async exec(params: any[]): Promise<any[]> {
    const res = await currentExecutor().query(toPgSql(this.sql), params);
    return res.rows;
  }
}

export class Db {
  prepare(sql: string): Statement {
    return new Statement(sql);
  }

  async exec(sql: string): Promise<void> {
    await currentExecutor().query(sql);
  }

  /** No-op: Postgres always enforces foreign keys and doesn't use a journal-mode pragma. */
  pragma(_directive: string): void {}

  /**
   * Mirrors better-sqlite3's db.transaction(fn) - returns an async function that,
   * when called, runs `fn` inside BEGIN/COMMIT (ROLLBACK on throw) on one dedicated
   * connection, and returns whatever `fn` returns.
   */
  transaction<A extends any[], R>(fn: (...args: A) => R | Promise<R>): (...args: A) => Promise<R> {
    return async (...args: A) => {
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        const result = await txStorage.run(client, () => fn(...args));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* connection already broken - nothing more to do */
        }
        throw err;
      } finally {
        client.release();
      }
    };
  }
}

const db = new Db();

function resolveDataDir(): string {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Resolves (and creates if missing) a subdirectory under the local data/ folder (used for prescription uploads etc). */
export function getUploadsDir(subdir: string): string {
  const dir = path.join(resolveDataDir(), 'uploads', subdir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function bootstrap(): Promise<void> {
  const schemaPath = path.join(process.cwd(), 'lib', 'schema.pg.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await getPool().query(schema);
  await runSeed(db);
}

export async function getDb(): Promise<Db> {
  if (!global.__kalsoomBootstrap) {
    global.__kalsoomBootstrap = bootstrap();
  }
  await global.__kalsoomBootstrap;
  return db;
}

// Small helpers -------------------------------------------------------------

export function nowIso(): string {
  return new Date().toISOString();
}

/** Generates the next sequential, human readable appointment number for a given day, e.g. KMC-20260617-0001 */
export async function nextAppointmentNo(db: Db, dateStr: string): Promise<string> {
  const compact = dateStr.replaceAll('-', '');
  const row = (await db.prepare(`SELECT COUNT(*) AS c FROM appointments WHERE appointment_date = ?`).get(dateStr)) as {
    c: number;
  };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `KMC-${compact}-${seq}`;
}

/**
 * Token number for a doctor's appointment. When the doctor has fixed time slots configured,
 * the token is that slot's fixed position in the doctor's ordered schedule (e.g. the 9:00 slot
 * is always token #1, 9:15 is always #2) - same every day, so the token printed on the slip
 * matches the patient's place in the doctor's actual queue order, not just booking order.
 * Falls back to a plain daily booking-order counter for doctors with no slots configured yet.
 */
export async function nextTokenNumber(db: Db, doctorId: number, dateStr: string, appointmentTime?: string): Promise<number> {
  if (appointmentTime) {
    const slots = (await db
      .prepare(`SELECT slot_time FROM doctor_slots WHERE doctor_id = ? ORDER BY slot_time ASC`)
      .all(doctorId)) as { slot_time: string }[];
    const idx = slots.findIndex((s) => s.slot_time === appointmentTime);
    if (idx !== -1) return idx + 1;
  }
  const row = (await db
    .prepare(`SELECT COUNT(*) AS c FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'`)
    .get(doctorId, dateStr)) as { c: number };
  return row.c + 1;
}

/** Generates a unique lab order number e.g. LAB-20260620-0003 */
export async function nextOrderNo(db: Db, dateStr: string): Promise<string> {
  const compact = dateStr.replaceAll('-', '');
  const row = (await db.prepare(`SELECT COUNT(*) AS c FROM lab_orders WHERE created_at LIKE ?`).get(`${dateStr}%`)) as {
    c: number;
  };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `LAB-${compact}-${seq}`;
}

/** Generates a unique lab sample id/barcode e.g. SMP-20260709-0001 */
export async function nextSampleId(db: Db, dateStr: string): Promise<string> {
  const compact = dateStr.replaceAll('-', '');
  const row = (await db.prepare(`SELECT COUNT(*) AS c FROM lab_samples WHERE created_at LIKE ?`).get(`${dateStr}%`)) as {
    c: number;
  };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `SMP-${compact}-${seq}`;
}

export async function nextSaleNo(db: Db, dateStr: string): Promise<string> {
  const compact = dateStr.replaceAll('-', '');
  const row = (await db.prepare(`SELECT COUNT(*) AS c FROM pharmacy_sales WHERE created_at LIKE ?`).get(`${dateStr}%`)) as {
    c: number;
  };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `PHM-${compact}-${seq}`;
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const db = await getDb();
  const row = (await db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key)) as { value: string } | undefined;
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

/** Generates a unique admission number e.g. IPD-20260621-0001 */
export async function nextAdmissionNo(db: Db, dateStr: string): Promise<string> {
  const compact = dateStr.replaceAll('-', '');
  const row = (await db.prepare(`SELECT COUNT(*) AS c FROM admissions WHERE admission_date = ?`).get(dateStr)) as {
    c: number;
  };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `IPD-${compact}-${seq}`;
}

/** Generates a unique surgery record number e.g. SRG-20260623-0001 */
export async function nextSurgeryNo(db: Db, dateStr: string): Promise<string> {
  const compact = dateStr.replaceAll('-', '');
  const row = (await db.prepare(`SELECT COUNT(*) AS c FROM surgery_records WHERE surgery_date = ?`).get(dateStr)) as {
    c: number;
  };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `SRG-${compact}-${seq}`;
}

/** Generates a unique purchase order number e.g. PO-20260623-0001 */
export async function nextPoNo(db: Db, dateStr: string): Promise<string> {
  const compact = dateStr.replaceAll('-', '');
  const row = (await db.prepare(`SELECT COUNT(*) AS c FROM purchase_orders WHERE created_at LIKE ?`).get(`${dateStr}%`)) as {
    c: number;
  };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `PO-${compact}-${seq}`;
}

/** Generates a unique purchase-return number e.g. PRET-20260623-0001 */
export async function nextPurchaseReturnNo(db: Db, dateStr: string): Promise<string> {
  const compact = dateStr.replaceAll('-', '');
  const row = (await db
    .prepare(`SELECT COUNT(*) AS c FROM purchase_returns WHERE created_at LIKE ?`)
    .get(`${dateStr}%`)) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `PRET-${compact}-${seq}`;
}

/** Generates a unique sale-return number e.g. RET-20260623-0001 */
export async function nextSaleReturnNo(db: Db, dateStr: string): Promise<string> {
  const compact = dateStr.replaceAll('-', '');
  const row = (await db
    .prepare(`SELECT COUNT(*) AS c FROM pharmacy_sale_returns WHERE created_at LIKE ?`)
    .get(`${dateStr}%`)) as { c: number };
  const seq = (row.c + 1).toString().padStart(4, '0');
  return `RET-${compact}-${seq}`;
}
