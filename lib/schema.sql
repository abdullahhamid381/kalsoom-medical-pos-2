-- Kalsoom Medical Complex - Appointment POS database schema
-- SQLite. This file is executed with CREATE TABLE IF NOT EXISTS so it is
-- always safe to run again - it will never wipe existing data.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super_admin','receptionist','doctor','pharmacy_admin','sales_person','lab_technician','ward_admin','lab_senior_technologist','lab_pathologist')),
  doctor_id     INTEGER REFERENCES doctors(id),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS doctors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  specialization  TEXT NOT NULL,
  department      TEXT NOT NULL DEFAULT 'General',
  fee             REAL NOT NULL DEFAULT 0,
  availability    TEXT NOT NULL DEFAULT 'Mon-Sat, 9:00 AM - 5:00 PM',
  phone           TEXT,
  description     TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  cnic        TEXT,
  age         INTEGER,
  gender      TEXT CHECK (gender IN ('Male','Female','Other')) DEFAULT 'Other',
  address     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS appointments (
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

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ─── PHARMACY ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS medicines (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  generic_name TEXT,
  category     TEXT,
  unit         TEXT NOT NULL DEFAULT 'tablet',
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price   REAL NOT NULL DEFAULT 0,
  stock_qty    REAL NOT NULL DEFAULT 0,
  low_stock_at REAL NOT NULL DEFAULT 10,
  manufacturer TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pharmacy_sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_no        TEXT NOT NULL UNIQUE,
  patient_id     INTEGER REFERENCES patients(id),
  patient_name   TEXT,
  patient_phone  TEXT,
  sold_by_user_id INTEGER NOT NULL REFERENCES users(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')) DEFAULT 'cash',
  subtotal       REAL NOT NULL DEFAULT 0,
  discount       REAL NOT NULL DEFAULT 0,
  total          REAL NOT NULL DEFAULT 0,
  paid_amount    REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
  notes          TEXT,
  whatsapp_sent  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pharmacy_sale_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id     INTEGER NOT NULL REFERENCES pharmacy_sales(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  medicine_name TEXT NOT NULL,
  unit        TEXT NOT NULL,
  qty         REAL NOT NULL,
  unit_price  REAL NOT NULL,
  total       REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pharm_sales_date ON pharmacy_sales(created_at);
CREATE INDEX IF NOT EXISTS idx_pharm_sale_items ON pharmacy_sale_items(sale_id);

-- Stock location: where the medicine physically sits ('pharmacy' counter or 'store' room)
-- Added via migration for existing rows; included here for fresh installs.

CREATE TABLE IF NOT EXISTS stock_movements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id     INTEGER NOT NULL REFERENCES medicines(id),
  medicine_name   TEXT NOT NULL,
  movement_type   TEXT NOT NULL CHECK (movement_type IN
                    ('purchase','adjustment','sale','transfer_in','transfer_out','opening')),
  location        TEXT NOT NULL CHECK (location IN ('pharmacy','store')) DEFAULT 'pharmacy',
  qty_change      REAL NOT NULL,        -- positive = stock added, negative = stock removed
  qty_before      REAL NOT NULL,
  qty_after       REAL NOT NULL,
  reference_no    TEXT,                  -- sale_no or PO number etc.
  notes           TEXT,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_medicine ON stock_movements(medicine_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);

-- ─── PHARMACY: SUPPLIERS & PURCHASING ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  contact_person  TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  notes           TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  po_no             TEXT NOT NULL UNIQUE,
  supplier_id       INTEGER NOT NULL REFERENCES suppliers(id),
  status            TEXT NOT NULL CHECK (status IN ('draft','ordered','partially_received','received','cancelled')) DEFAULT 'draft',
  order_date        TEXT NOT NULL DEFAULT (date('now')),
  expected_date     TEXT,
  subtotal          REAL NOT NULL DEFAULT 0,
  discount          REAL NOT NULL DEFAULT 0,
  total             REAL NOT NULL DEFAULT 0,
  notes             TEXT,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id         INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  medicine_id   INTEGER NOT NULL REFERENCES medicines(id),
  medicine_name TEXT NOT NULL,
  ordered_qty   REAL NOT NULL,
  received_qty  REAL NOT NULL DEFAULT 0,
  unit_price    REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date     ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po  ON purchase_order_items(po_id);

-- ─── PHARMACY: BATCHES ───────────────────────────────────────────────────────
-- Supplementary expiry-tracking layer. medicines.stock_qty / stock_qty_store
-- stay the authoritative counters; batches are updated alongside them, not
-- instead of them, so untracked medicines keep working exactly as before.

CREATE TABLE IF NOT EXISTS medicine_batches (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id       INTEGER NOT NULL REFERENCES medicines(id),
  batch_no          TEXT NOT NULL,
  expiry_date       TEXT NOT NULL,
  mfg_date          TEXT,
  qty               REAL NOT NULL DEFAULT 0,
  purchase_price    REAL NOT NULL DEFAULT 0,
  sale_price        REAL NOT NULL DEFAULT 0,
  location          TEXT NOT NULL CHECK (location IN ('pharmacy','store')) DEFAULT 'store',
  supplier_id       INTEGER REFERENCES suppliers(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  reference_no      TEXT,
  notes             TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_medicine_batches_medicine ON medicine_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicine_batches_expiry   ON medicine_batches(expiry_date);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
  amount          REAL NOT NULL,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')) DEFAULT 'cash',
  reference_no    TEXT,
  notes           TEXT,
  paid_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no           TEXT NOT NULL UNIQUE,
  supplier_id         INTEGER NOT NULL REFERENCES suppliers(id),
  po_id               INTEGER REFERENCES purchase_orders(id),
  reason              TEXT,
  total               REAL NOT NULL DEFAULT 0,
  created_by_user_id  INTEGER NOT NULL REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id     INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
  batch_id      INTEGER NOT NULL REFERENCES medicine_batches(id),
  medicine_id   INTEGER NOT NULL REFERENCES medicines(id),
  medicine_name TEXT NOT NULL,
  qty           REAL NOT NULL,
  unit_price    REAL NOT NULL,
  total         REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id);

-- ─── PHARMACY: SALE RETURNS & CUSTOMER CREDIT ────────────────────────────────

CREATE TABLE IF NOT EXISTS pharmacy_sale_returns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no           TEXT NOT NULL UNIQUE,
  sale_id             INTEGER NOT NULL REFERENCES pharmacy_sales(id),
  outcome             TEXT NOT NULL CHECK (outcome IN ('refund','store_credit','exchange')),
  refund_amount       REAL NOT NULL DEFAULT 0,
  credit_amount       REAL NOT NULL DEFAULT 0,
  total               REAL NOT NULL DEFAULT 0,
  reason              TEXT,
  created_by_user_id  INTEGER NOT NULL REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pharmacy_sale_return_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id     INTEGER NOT NULL REFERENCES pharmacy_sale_returns(id) ON DELETE CASCADE,
  sale_item_id  INTEGER NOT NULL REFERENCES pharmacy_sale_items(id),
  medicine_id   INTEGER NOT NULL REFERENCES medicines(id),
  medicine_name TEXT NOT NULL,
  batch_id      INTEGER REFERENCES medicine_batches(id),
  qty           REAL NOT NULL,
  unit_price    REAL NOT NULL,
  total         REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_sale_returns_sale        ON pharmacy_sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_sale_return_items_return ON pharmacy_sale_return_items(return_id);

CREATE TABLE IF NOT EXISTS customer_credits (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  phone             TEXT NOT NULL,
  customer_name     TEXT,
  amount            REAL NOT NULL,   -- positive = credit issued, negative = credit redeemed
  source            TEXT NOT NULL CHECK (source IN ('return','redeemed','manual')),
  sale_return_id    INTEGER REFERENCES pharmacy_sale_returns(id),
  redeemed_sale_id  INTEGER REFERENCES pharmacy_sales(id),
  notes             TEXT,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_credits_phone ON customer_credits(phone);

-- ─── PHARMACY: PRESCRIPTIONS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prescriptions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id             INTEGER REFERENCES pharmacy_sales(id),
  patient_id          INTEGER REFERENCES patients(id),
  patient_name        TEXT,
  patient_phone       TEXT,
  doctor_name         TEXT,
  file_name           TEXT NOT NULL,
  file_path           TEXT NOT NULL,
  mime_type           TEXT NOT NULL,
  file_size           INTEGER NOT NULL,
  notes               TEXT,
  uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_sale    ON prescriptions(sale_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

-- ─── LAB ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lab_tests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  category     TEXT,
  price        REAL NOT NULL DEFAULT 0,
  turnaround   TEXT DEFAULT '24 hours',
  description  TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_orders (
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
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  test_id     INTEGER NOT NULL REFERENCES lab_tests(id),
  test_name   TEXT NOT NULL,
  price       REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lab_orders_date    ON lab_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_order_items    ON lab_order_items(order_id);

-- ─── LAB: PANELS / RANGES / SAMPLES / RESULTS ───────────────────────────────

CREATE TABLE IF NOT EXISTS lab_panels (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  category     TEXT,
  price        REAL NOT NULL DEFAULT 0,
  turnaround   TEXT DEFAULT '24 hours',
  description  TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_panel_tests (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  panel_id  INTEGER NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
  test_id   INTEGER NOT NULL REFERENCES lab_tests(id),
  UNIQUE(panel_id, test_id)
);
CREATE INDEX IF NOT EXISTS idx_lab_panel_tests_panel ON lab_panel_tests(panel_id);

CREATE TABLE IF NOT EXISTS lab_order_panels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  panel_id   INTEGER NOT NULL REFERENCES lab_panels(id),
  panel_name TEXT NOT NULL,
  price      REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lab_order_panels_order ON lab_order_panels(order_id);

CREATE TABLE IF NOT EXISTS lab_test_reference_ranges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id       INTEGER NOT NULL REFERENCES lab_tests(id) ON DELETE CASCADE,
  gender        TEXT NOT NULL CHECK (gender IN ('any','male','female')) DEFAULT 'any',
  age_min       REAL NOT NULL DEFAULT 0,
  age_max       REAL NOT NULL DEFAULT 150,
  value_type    TEXT NOT NULL CHECK (value_type IN ('numeric','text')) DEFAULT 'numeric',
  low           REAL,
  high          REAL,
  unit          TEXT,
  normal_text   TEXT,
  critical_low  REAL,
  critical_high REAL,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_ref_ranges_test ON lab_test_reference_ranges(test_id);

CREATE TABLE IF NOT EXISTS lab_samples (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  sample_id             TEXT NOT NULL UNIQUE,
  order_id              INTEGER NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  sample_type           TEXT NOT NULL DEFAULT 'blood',
  status                TEXT NOT NULL CHECK (status IN
                          ('ordered','collected','received','processing','result_ready','delivered','rejected')) DEFAULT 'ordered',
  collected_at          TEXT,
  collected_by_user_id  INTEGER REFERENCES users(id),
  received_at           TEXT,
  received_by_user_id   INTEGER REFERENCES users(id),
  rejection_reason      TEXT,
  recollect_required    INTEGER NOT NULL DEFAULT 0,
  replaces_sample_id    INTEGER REFERENCES lab_samples(id),
  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_samples_order ON lab_samples(order_id);

CREATE TABLE IF NOT EXISTS lab_results (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id            INTEGER NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  order_item_id       INTEGER NOT NULL UNIQUE REFERENCES lab_order_items(id) ON DELETE CASCADE,
  test_id             INTEGER NOT NULL REFERENCES lab_tests(id),
  value_type          TEXT NOT NULL CHECK (value_type IN ('numeric','text')) DEFAULT 'numeric',
  value_numeric       REAL,
  value_text          TEXT,
  unit                TEXT,
  reference_range_id  INTEGER REFERENCES lab_test_reference_ranges(id),
  reference_display   TEXT,
  flag                TEXT CHECK (flag IN ('low','normal','high','critical')),
  comment             TEXT,
  entered_by_user_id  INTEGER REFERENCES users(id),
  entered_at          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_results_order ON lab_results(order_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_test  ON lab_results(test_id);

-- ─── LAB: REFERRING DOCTORS / AMENDMENTS / HOME COLLECTION / EQUIPMENT / REAGENTS / MICROBIOLOGY ──

CREATE TABLE IF NOT EXISTS lab_referring_doctors (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  phone              TEXT,
  commission_percent REAL NOT NULL DEFAULT 0,
  active             INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_result_amendments (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id          INTEGER NOT NULL REFERENCES lab_results(id) ON DELETE CASCADE,
  old_value_numeric  REAL,
  old_value_text     TEXT,
  new_value_numeric  REAL,
  new_value_text     TEXT,
  reason             TEXT,
  amended_by_user_id INTEGER NOT NULL REFERENCES users(id),
  amended_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_result_amendments_result ON lab_result_amendments(result_id);

CREATE TABLE IF NOT EXISTS lab_home_collections (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id          INTEGER NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  collector_user_id INTEGER REFERENCES users(id),
  address           TEXT,
  scheduled_at      TEXT,
  status            TEXT NOT NULL CHECK (status IN ('assigned','collected','cancelled')) DEFAULT 'assigned',
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_home_collections_order ON lab_home_collections(order_id);

CREATE TABLE IF NOT EXISTS lab_equipment (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  model        TEXT,
  serial_no    TEXT,
  location     TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_equipment_maintenance (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id     INTEGER NOT NULL REFERENCES lab_equipment(id) ON DELETE CASCADE,
  maintenance_date TEXT NOT NULL DEFAULT (date('now')),
  next_due_date    TEXT,
  performed_by     TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_equip_maint_equipment ON lab_equipment_maintenance(equipment_id);
CREATE INDEX IF NOT EXISTS idx_lab_equip_maint_due ON lab_equipment_maintenance(next_due_date);

CREATE TABLE IF NOT EXISTS lab_reagents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'ml',
  stock_qty    REAL NOT NULL DEFAULT 0,
  low_stock_at REAL NOT NULL DEFAULT 10,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lab_reagent_batches (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  reagent_id         INTEGER NOT NULL REFERENCES lab_reagents(id),
  batch_no           TEXT NOT NULL,
  expiry_date        TEXT NOT NULL,
  qty                REAL NOT NULL DEFAULT 0,
  active             INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_reagent_batches_reagent ON lab_reagent_batches(reagent_id);
CREATE INDEX IF NOT EXISTS idx_lab_reagent_batches_expiry  ON lab_reagent_batches(expiry_date);

CREATE TABLE IF NOT EXISTS lab_reagent_movements (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  reagent_id         INTEGER NOT NULL REFERENCES lab_reagents(id),
  movement_type      TEXT NOT NULL CHECK (movement_type IN ('opening','adjustment','consumption')),
  qty_change         REAL NOT NULL,
  qty_before         REAL NOT NULL,
  qty_after          REAL NOT NULL,
  reference_no       TEXT,
  batch_id           INTEGER REFERENCES lab_reagent_batches(id),
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_reagent_movements_reagent ON lab_reagent_movements(reagent_id);

CREATE TABLE IF NOT EXISTS lab_test_reagents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id      INTEGER NOT NULL REFERENCES lab_tests(id) ON DELETE CASCADE,
  reagent_id   INTEGER NOT NULL REFERENCES lab_reagents(id),
  qty_per_test REAL NOT NULL DEFAULT 1,
  UNIQUE(test_id, reagent_id)
);

CREATE TABLE IF NOT EXISTS lab_organisms (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lab_antibiotics (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lab_culture_organisms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL REFERENCES lab_order_items(id) ON DELETE CASCADE,
  organism_id   INTEGER NOT NULL REFERENCES lab_organisms(id),
  growth_count  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lab_culture_org_item ON lab_culture_organisms(order_item_id);

CREATE TABLE IF NOT EXISTS lab_culture_sensitivities (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  culture_organism_id INTEGER NOT NULL REFERENCES lab_culture_organisms(id) ON DELETE CASCADE,
  antibiotic_id       INTEGER NOT NULL REFERENCES lab_antibiotics(id),
  result              TEXT NOT NULL CHECK (result IN ('S','I','R')),
  UNIQUE(culture_organism_id, antibiotic_id)
);

-- ─── IPD / HOSPITAL ADMISSION ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rooms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  room_no       TEXT NOT NULL UNIQUE,
  room_type     TEXT NOT NULL CHECK (room_type IN ('general','ac','non_ac','private','icu','semi_private')) DEFAULT 'general',
  floor         TEXT,
  price_per_day REAL NOT NULL DEFAULT 0,
  description   TEXT,
  status        TEXT NOT NULL CHECK (status IN ('available','occupied','maintenance')) DEFAULT 'available',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admissions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  admission_no      TEXT NOT NULL UNIQUE,
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  room_id           INTEGER NOT NULL REFERENCES rooms(id),
  doctor_id         INTEGER REFERENCES doctors(id),
  admitted_by_user_id INTEGER NOT NULL REFERENCES users(id),
  diagnosis         TEXT,
  admission_date    TEXT NOT NULL,
  admission_time    TEXT NOT NULL,
  discharge_date    TEXT,
  discharge_time    TEXT,
  days_stayed       INTEGER DEFAULT 0,
  status            TEXT NOT NULL CHECK (status IN ('admitted','discharged','transferred')) DEFAULT 'admitted',
  room_charge_total REAL NOT NULL DEFAULT 0,
  medicine_total    REAL NOT NULL DEFAULT 0,
  lab_total         REAL NOT NULL DEFAULT 0,
  procedure_total   REAL NOT NULL DEFAULT 0,
  other_total       REAL NOT NULL DEFAULT 0,
  grand_total       REAL NOT NULL DEFAULT 0,
  discount          REAL NOT NULL DEFAULT 0,
  paid_amount       REAL NOT NULL DEFAULT 0,
  payment_status    TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
  payment_method    TEXT CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')),
  notes             TEXT,
  whatsapp_sent     INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admission_charges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  admission_id  INTEGER NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  charge_type   TEXT NOT NULL CHECK (charge_type IN ('room','medicine','lab','procedure','doctor_fee','nursing','other')),
  description   TEXT NOT NULL,
  quantity      REAL NOT NULL DEFAULT 1,
  unit_price    REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL DEFAULT 0,
  charge_date   TEXT NOT NULL DEFAULT (date('now')),
  ref_sale_id   INTEGER,     -- links to pharmacy_sales.id if medicine
  ref_order_id  INTEGER,     -- links to lab_orders.id if lab
  added_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admissions_patient  ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status   ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admission_charges   ON admission_charges(admission_id, charge_date);

-- ─── SURGERY ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS surgery_types (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  category     TEXT,
  base_price   REAL NOT NULL DEFAULT 0,
  description  TEXT,
  duration_hrs REAL DEFAULT 1,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS surgery_records (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  surgery_no        TEXT NOT NULL UNIQUE,
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  admission_id      INTEGER REFERENCES admissions(id),
  surgery_type_id   INTEGER NOT NULL REFERENCES surgery_types(id),
  surgeon_id        INTEGER REFERENCES doctors(id),
  anesthetist       TEXT,
  surgery_date      TEXT NOT NULL,
  surgery_time      TEXT,
  duration_hrs      REAL,
  theatre_no        TEXT,
  diagnosis         TEXT,
  procedure_notes   TEXT,
  surgery_fee       REAL NOT NULL DEFAULT 0,
  anesthesia_fee    REAL NOT NULL DEFAULT 0,
  theatre_fee       REAL NOT NULL DEFAULT 0,
  medicine_cost     REAL NOT NULL DEFAULT 0,
  other_charges     REAL NOT NULL DEFAULT 0,
  total_cost        REAL NOT NULL DEFAULT 0,
  discount          REAL NOT NULL DEFAULT 0,
  paid_amount       REAL NOT NULL DEFAULT 0,
  payment_status    TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
  payment_method    TEXT CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')),
  status            TEXT NOT NULL CHECK (status IN ('scheduled','completed','cancelled')) DEFAULT 'scheduled',
  outcome           TEXT,
  booked_by_user_id INTEGER NOT NULL REFERENCES users(id),
  whatsapp_sent     INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_surgery_patient ON surgery_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_surgery_date    ON surgery_records(surgery_date);
