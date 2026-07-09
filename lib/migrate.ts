import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// SQLite can't ALTER a CHECK constraint or add a foreign key to an existing
// table directly. When the app's schema grows (new role, new status value),
// already-deployed databases need their `users` / `appointments` tables
// rebuilt: create a new table with the right definition, copy every row
// across untouched, drop the old one. This preserves 100% of existing data
// (ids, password hashes, history) - it only changes what values the table
// *will accept going forward*. Both rebuilds run inside a transaction so a
// failure can't leave the database half-migrated.
// ---------------------------------------------------------------------------

function tableSql(db: Database.Database, table: string): string {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table) as { sql: string } | undefined;
  return row?.sql || '';
}

function columnNames(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string) {
  if (!columnNames(db, table).includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateUsersTable(db: Database.Database) {
  const sql = tableSql(db, 'users');
  if (!sql || sql.includes("'doctor'")) return; // already up to date (or table doesn't exist yet)

  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE users_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('super_admin','receptionist','doctor')),
        doctor_id     INTEGER REFERENCES doctors(id),
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_new (id, name, username, password_hash, role, active, created_at)
        SELECT id, name, username, password_hash, role, active, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function migrateAppointmentsTable(db: Database.Database) {
  const sql = tableSql(db, 'appointments');
  if (!sql || sql.includes("'checked_in'")) return;

  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE appointments_new (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_no    TEXT NOT NULL UNIQUE,
        token_number      INTEGER NOT NULL,
        patient_id        INTEGER NOT NULL REFERENCES patients(id),
        doctor_id         INTEGER NOT NULL REFERENCES doctors(id),
        booked_by_user_id INTEGER NOT NULL REFERENCES users(id),
        appointment_date  TEXT NOT NULL,
        appointment_time  TEXT NOT NULL,
        department        TEXT,
        reason            TEXT,
        payment_method    TEXT NOT NULL CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')),
        amount            REAL NOT NULL DEFAULT 0,
        discount          REAL NOT NULL DEFAULT 0,
        paid_amount       REAL NOT NULL DEFAULT 0,
        payment_status    TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
        status            TEXT NOT NULL CHECK (status IN ('pending','confirmed','checked_in','completed','cancelled','no_show')) DEFAULT 'pending',
        notes             TEXT,
        whatsapp_sent     INTEGER NOT NULL DEFAULT 0,
        whatsapp_sent_at  TEXT,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO appointments_new SELECT * FROM appointments;
      DROP TABLE appointments;
      ALTER TABLE appointments_new RENAME TO appointments;
      CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id, appointment_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
    `);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function runMigrations(db: Database.Database) {
  addColumnIfMissing(db, 'doctors', 'description', 'TEXT');
  migrateUsersTable(db);
  migrateAppointmentsTable(db);
  // Pharmacy tables are created by schema.sql (CREATE TABLE IF NOT EXISTS),
  // so no rebuild needed - they appear automatically on first run.
  addColumnIfMissing(db, 'medicines', 'generic_name', 'TEXT');
  addColumnIfMissing(db, 'medicines', 'manufacturer', 'TEXT');
  // Stock location fields — pharmacy counter qty vs. store room qty
  addColumnIfMissing(db, 'medicines', 'location', "TEXT NOT NULL DEFAULT 'pharmacy'");
  addColumnIfMissing(db, 'medicines', 'stock_qty_store', 'REAL NOT NULL DEFAULT 0');
  // Expand roles check to include pharmacy_admin and sales_person
  migrateUsersForPharmacyRoles(db);
  // Expand roles to include lab_technician
  migrateUsersForLabRole(db);
  // Expand roles to include ward_admin
  migrateUsersForWardRole(db);
  // Prescription requirement flag on medicines; batch + return-tracking on sale items
  addColumnIfMissing(db, 'medicines', 'prescription_required', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'pharmacy_sale_items', 'batch_id', 'INTEGER REFERENCES medicine_batches(id)');
  addColumnIfMissing(db, 'pharmacy_sale_items', 'returned_qty', 'REAL NOT NULL DEFAULT 0');
  // Expand movement_type to cover sale/purchase returns, add batch linkage
  migrateStockMovementsForReturns(db);

  // Lab: panels, sample tracking, and the clinical report workflow
  addColumnIfMissing(db, 'lab_tests', 'default_sample_type', "TEXT NOT NULL DEFAULT 'blood'");
  addColumnIfMissing(db, 'lab_order_items', 'order_panel_id', 'INTEGER REFERENCES lab_order_panels(id)');
  addColumnIfMissing(db, 'lab_order_items', 'sample_id', 'INTEGER REFERENCES lab_samples(id)');
  addColumnIfMissing(db, 'lab_orders', 'report_status',
    "TEXT NOT NULL DEFAULT 'pending' CHECK (report_status IN ('pending','entered','reported'))");
  addColumnIfMissing(db, 'lab_orders', 'reported_by_user_id', 'INTEGER REFERENCES users(id)');
  addColumnIfMissing(db, 'lab_orders', 'reported_at', 'TEXT');
  addColumnIfMissing(db, 'lab_orders', 'verification_token', 'TEXT');
  addColumnIfMissing(db, 'lab_orders', 'report_whatsapp_sent', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'lab_orders', 'report_whatsapp_sent_at', 'TEXT');

  // Lab Phase 2: multi-level verification roles + the lab_orders report_status widen (rebuild)
  migrateUsersForLabRolesV2(db);
  migrateLabOrdersV2(db);

  // Lab Phase 2: remaining additive columns (no CHECK widening needed, plain ADD COLUMN)
  addColumnIfMissing(db, 'lab_order_items', 'assigned_technician_id', 'INTEGER REFERENCES users(id)');
  addColumnIfMissing(db, 'lab_order_items', 'reagent_deducted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'lab_results', 'delta_flag', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'lab_results', 'critical_notified_at', 'TEXT');
  addColumnIfMissing(db, 'lab_results', 'critical_notified_by_user_id', 'INTEGER REFERENCES users(id)');
  addColumnIfMissing(db, 'lab_results', 'critical_notify_notes', 'TEXT');
  addColumnIfMissing(db, 'lab_tests', 'turnaround_hours', 'REAL');
  addColumnIfMissing(db, 'lab_tests', 'is_culture', 'INTEGER NOT NULL DEFAULT 0');

  // IPD: marks the single system-maintained "room" charge row so it can be recalculated/replaced
  // automatically (days stayed × room rate) instead of relying on staff to add it manually.
  addColumnIfMissing(db, 'admission_charges', 'auto_generated', 'INTEGER NOT NULL DEFAULT 0');
}

function migrateUsersForLabRolesV2(db: Database.Database) {
  const sql = tableSql(db, 'users');
  if (!sql || sql.includes("'lab_senior_technologist'")) return;

  // `users` is referenced by many tables across the app (appointments, lab_orders,
  // admissions, stock_movements, ...) with real rows in a live database. Rebuilding it
  // while PRAGMA foreign_keys=ON trips SQLite's referential check on DROP TABLE even
  // though no data is actually being removed - toggle it off for this narrow window,
  // exactly as SQLite's own docs recommend for this kind of legacy-table rebuild.
  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE users_lab_v2 (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('super_admin','receptionist','doctor','pharmacy_admin','sales_person','lab_technician','ward_admin','lab_senior_technologist','lab_pathologist')),
        doctor_id     INTEGER REFERENCES doctors(id),
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_lab_v2 SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_lab_v2 RENAME TO users;
    `);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function migrateLabOrdersV2(db: Database.Database) {
  const sql = tableSql(db, 'lab_orders');
  if (!sql || sql.includes("'reviewed'")) return;

  // Same reasoning as migrateUsersForLabRolesV2: lab_orders is referenced by
  // lab_order_items/lab_order_panels/lab_samples with real rows, so drop/rebuild
  // needs foreign_keys off for this transaction.
  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE lab_orders_v2 (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no         TEXT NOT NULL UNIQUE,
        patient_id       INTEGER REFERENCES patients(id),
        patient_name     TEXT NOT NULL,
        patient_phone    TEXT,
        patient_age      INTEGER,
        patient_gender   TEXT,
        referring_doctor TEXT,
        booked_by_user_id INTEGER NOT NULL REFERENCES users(id),
        payment_method   TEXT NOT NULL CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')) DEFAULT 'cash',
        subtotal         REAL NOT NULL DEFAULT 0,
        discount         REAL NOT NULL DEFAULT 0,
        total            REAL NOT NULL DEFAULT 0,
        paid_amount      REAL NOT NULL DEFAULT 0,
        payment_status   TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
        status           TEXT NOT NULL CHECK (status IN ('pending','processing','completed','cancelled')) DEFAULT 'pending',
        notes            TEXT,
        whatsapp_sent    INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
        report_status    TEXT NOT NULL DEFAULT 'pending' CHECK (report_status IN ('pending','entered','reviewed','reported')),
        reported_by_user_id INTEGER REFERENCES users(id),
        reported_at      TEXT,
        verification_token TEXT,
        report_whatsapp_sent INTEGER NOT NULL DEFAULT 0,
        report_whatsapp_sent_at TEXT,
        appointment_id   INTEGER REFERENCES appointments(id),
        admission_id     INTEGER REFERENCES admissions(id),
        priority         TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
        reviewed_by_user_id INTEGER REFERENCES users(id),
        reviewed_at      TEXT,
        collection_mode  TEXT NOT NULL DEFAULT 'lab' CHECK (collection_mode IN ('lab','home')),
        insurance_provider TEXT,
        tpa_reference    TEXT,
        claim_status     TEXT NOT NULL DEFAULT 'none' CHECK (claim_status IN ('none','pending','submitted','approved','rejected')),
        referring_doctor_id INTEGER REFERENCES lab_referring_doctors(id)
      );
      INSERT INTO lab_orders_v2 (id, order_no, patient_id, patient_name, patient_phone, patient_age, patient_gender,
        referring_doctor, booked_by_user_id, payment_method, subtotal, discount, total, paid_amount, payment_status,
        status, notes, whatsapp_sent, created_at, updated_at, report_status, reported_by_user_id, reported_at,
        verification_token, report_whatsapp_sent, report_whatsapp_sent_at)
      SELECT id, order_no, patient_id, patient_name, patient_phone, patient_age, patient_gender,
        referring_doctor, booked_by_user_id, payment_method, subtotal, discount, total, paid_amount, payment_status,
        status, notes, whatsapp_sent, created_at, updated_at, report_status, reported_by_user_id, reported_at,
        verification_token, report_whatsapp_sent, report_whatsapp_sent_at
      FROM lab_orders;
      DROP TABLE lab_orders;
      ALTER TABLE lab_orders_v2 RENAME TO lab_orders;
      CREATE INDEX IF NOT EXISTS idx_lab_orders_date    ON lab_orders(created_at);
      CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
      CREATE INDEX IF NOT EXISTS idx_lab_orders_appointment ON lab_orders(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_lab_orders_admission   ON lab_orders(admission_id);
    `);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function migrateStockMovementsForReturns(db: Database.Database) {
  const sql = tableSql(db, 'stock_movements');
  if (!sql || sql.includes("'sale_return'")) return;

  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE stock_movements_new (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id     INTEGER NOT NULL REFERENCES medicines(id),
        medicine_name   TEXT NOT NULL,
        movement_type   TEXT NOT NULL CHECK (movement_type IN
                          ('purchase','adjustment','sale','transfer_in','transfer_out','opening','sale_return','purchase_return')),
        location        TEXT NOT NULL CHECK (location IN ('pharmacy','store')) DEFAULT 'pharmacy',
        qty_change      REAL NOT NULL,
        qty_before      REAL NOT NULL,
        qty_after       REAL NOT NULL,
        reference_no    TEXT,
        notes           TEXT,
        batch_id        INTEGER REFERENCES medicine_batches(id),
        created_by_user_id INTEGER NOT NULL REFERENCES users(id),
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO stock_movements_new (id, medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, reference_no, notes, created_by_user_id, created_at)
        SELECT id, medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, reference_no, notes, created_by_user_id, created_at FROM stock_movements;
      DROP TABLE stock_movements;
      ALTER TABLE stock_movements_new RENAME TO stock_movements;
      CREATE INDEX IF NOT EXISTS idx_stock_movements_medicine ON stock_movements(medicine_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
    `);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function migrateUsersForWardRole(db: Database.Database) {
  const sql = tableSql(db, 'users');
  if (!sql || sql.includes("'ward_admin'")) return;
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE users_ward (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('super_admin','receptionist','doctor','pharmacy_admin','sales_person','lab_technician','ward_admin')),
        doctor_id     INTEGER REFERENCES doctors(id),
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_ward SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_ward RENAME TO users;
    `);
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
}

function migrateUsersForPharmacyRoles(db: Database.Database) {
  const sql = tableSql(db, 'users');
  if (!sql || sql.includes("'pharmacy_admin'")) return;

  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE users_pharm (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('super_admin','receptionist','doctor','pharmacy_admin','sales_person')),
        doctor_id     INTEGER REFERENCES doctors(id),
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_pharm SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_pharm RENAME TO users;
    `);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function migrateUsersForLabRole(db: Database.Database) {
  const sql = tableSql(db, 'users');
  if (!sql || sql.includes("'lab_technician'")) return;

  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE users_lab (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        username      TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('super_admin','receptionist','doctor','pharmacy_admin','sales_person','lab_technician')),
        doctor_id     INTEGER REFERENCES doctors(id),
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_lab SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_lab RENAME TO users;
    `);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
