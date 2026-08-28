-- Kalsoom Medical Complex - Appointment POS database schema (PostgreSQL / Neon)
-- Generated from the SQLite schema. Safe to run repeatedly (IF NOT EXISTS everywhere).

CREATE OR REPLACE FUNCTION now_iso() RETURNS TEXT AS $$
  SELECT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION today_iso() RETURNS TEXT AS $$
  SELECT to_char(now() at time zone 'utc', 'YYYY-MM-DD');
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION today_plus_iso(days_ahead INTEGER) RETURNS TEXT AS $$
  SELECT to_char((now() at time zone 'utc') + (days_ahead || ' days')::interval, 'YYYY-MM-DD');
$$ LANGUAGE SQL STABLE;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','receptionist','receptionist_admin','doctor','pharmacy_admin','sales_person','lab_technician','ward_admin','lab_senior_technologist','lab_pathologist')),
  doctor_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'General',
  fee REAL NOT NULL DEFAULT 0,
  availability TEXT NOT NULL DEFAULT 'Mon-Sat,
  9:00 AM - 5:00 PM',
  phone TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS doctor_slots (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL,
  slot_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  cnic TEXT,
  age INTEGER,
  gender TEXT CHECK (gender IN ('Male','Female','Other')) DEFAULT 'Other',
  address TEXT,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  appointment_no TEXT NOT NULL UNIQUE,
  token_number INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL,
  booked_by_user_id INTEGER NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  department TEXT,
  reason TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')),
  amount REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
  status TEXT NOT NULL CHECK (status IN ('pending','confirmed','checked_in','completed','cancelled','no_show')) DEFAULT 'pending',
  notes TEXT,
  whatsapp_sent INTEGER NOT NULL DEFAULT 0,
  whatsapp_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT now_iso(),
  updated_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS medicines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  generic_name TEXT,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'tablet',
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
  low_stock_at REAL NOT NULL DEFAULT 10,
  manufacturer TEXT,
  location TEXT NOT NULL DEFAULT 'pharmacy',
  stock_qty_store REAL NOT NULL DEFAULT 0,
  prescription_required INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS pharmacy_sales (
  id SERIAL PRIMARY KEY,
  sale_no TEXT NOT NULL UNIQUE,
  patient_id INTEGER,
  patient_name TEXT,
  patient_phone TEXT,
  sold_by_user_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')) DEFAULT 'cash',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
  notes TEXT,
  whatsapp_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS pharmacy_sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL,
  batch_id INTEGER,
  returned_qty REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase','adjustment','sale','transfer_in','transfer_out','opening','sale_return','purchase_return')),
  location TEXT NOT NULL CHECK (location IN ('pharmacy','store')) DEFAULT 'pharmacy',
  qty_change REAL NOT NULL,
  qty_before REAL NOT NULL,
  qty_after REAL NOT NULL,
  reference_no TEXT,
  notes TEXT,
  batch_id INTEGER,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_no TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','ordered','partially_received','received','cancelled')) DEFAULT 'draft',
  order_date TEXT NOT NULL DEFAULT today_iso(),
  expected_date TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso(),
  updated_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT NOT NULL,
  ordered_qty REAL NOT NULL,
  received_qty REAL NOT NULL DEFAULT 0,
  unit_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS medicine_batches (
  id SERIAL PRIMARY KEY,
  medicine_id INTEGER NOT NULL,
  batch_no TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  mfg_date TEXT,
  qty REAL NOT NULL DEFAULT 0,
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  location TEXT NOT NULL CHECK (location IN ('pharmacy','store')) DEFAULT 'store',
  supplier_id INTEGER,
  purchase_order_id INTEGER,
  reference_no TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')) DEFAULT 'cash',
  reference_no TEXT,
  notes TEXT,
  paid_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id SERIAL PRIMARY KEY,
  return_no TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL,
  po_id INTEGER,
  reason TEXT,
  total REAL NOT NULL DEFAULT 0,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id SERIAL PRIMARY KEY,
  return_id INTEGER NOT NULL,
  batch_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT NOT NULL,
  qty REAL NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pharmacy_sale_returns (
  id SERIAL PRIMARY KEY,
  return_no TEXT NOT NULL UNIQUE,
  sale_id INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('refund','store_credit','exchange')),
  refund_amount REAL NOT NULL DEFAULT 0,
  credit_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  reason TEXT,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS pharmacy_sale_return_items (
  id SERIAL PRIMARY KEY,
  return_id INTEGER NOT NULL,
  sale_item_id INTEGER NOT NULL,
  medicine_id INTEGER NOT NULL,
  medicine_name TEXT NOT NULL,
  batch_id INTEGER,
  qty REAL NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_credits (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  customer_name TEXT,
  amount REAL NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('return','redeemed','manual')),
  sale_return_id INTEGER,
  redeemed_sale_id INTEGER,
  notes TEXT,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER,
  patient_id INTEGER,
  patient_name TEXT,
  patient_phone TEXT,
  doctor_name TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  notes TEXT,
  uploaded_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_tests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  price REAL NOT NULL DEFAULT 0,
  turnaround TEXT DEFAULT '24 hours',
  description TEXT,
  default_sample_type TEXT NOT NULL DEFAULT 'blood',
  turnaround_hours REAL,
  is_culture INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_orders (
  id SERIAL PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  patient_id INTEGER,
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  patient_age INTEGER,
  patient_gender TEXT,
  referring_doctor TEXT,
  booked_by_user_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')) DEFAULT 'cash',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
  status TEXT NOT NULL CHECK (status IN ('pending','processing','completed','cancelled')) DEFAULT 'pending',
  notes TEXT,
  whatsapp_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT now_iso(),
  updated_at TEXT NOT NULL DEFAULT now_iso(),
  report_status TEXT NOT NULL DEFAULT 'pending' CHECK (report_status IN ('pending','entered','reviewed','reported')),
  reported_by_user_id INTEGER,
  reported_at TEXT,
  verification_token TEXT,
  report_whatsapp_sent INTEGER NOT NULL DEFAULT 0,
  report_whatsapp_sent_at TEXT,
  appointment_id INTEGER,
  admission_id INTEGER,
  priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
  reviewed_by_user_id INTEGER,
  reviewed_at TEXT,
  collection_mode TEXT NOT NULL DEFAULT 'lab' CHECK (collection_mode IN ('lab','home')),
  insurance_provider TEXT,
  tpa_reference TEXT,
  claim_status TEXT NOT NULL DEFAULT 'none' CHECK (claim_status IN ('none','pending','submitted','approved','rejected')),
  referring_doctor_id INTEGER
);

CREATE TABLE IF NOT EXISTS lab_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  test_id INTEGER NOT NULL,
  test_name TEXT NOT NULL,
  price REAL NOT NULL,
  order_panel_id INTEGER,
  sample_id INTEGER,
  assigned_technician_id INTEGER,
  reagent_deducted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lab_panels (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  price REAL NOT NULL DEFAULT 0,
  turnaround TEXT DEFAULT '24 hours',
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_panel_tests (
  id SERIAL PRIMARY KEY,
  panel_id INTEGER NOT NULL,
  test_id INTEGER NOT NULL,
  UNIQUE(panel_id, test_id)
);

CREATE TABLE IF NOT EXISTS lab_order_panels (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  panel_id INTEGER NOT NULL,
  panel_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lab_test_reference_ranges (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('any','male','female')) DEFAULT 'any',
  age_min REAL NOT NULL DEFAULT 0,
  age_max REAL NOT NULL DEFAULT 150,
  value_type TEXT NOT NULL CHECK (value_type IN ('numeric','text')) DEFAULT 'numeric',
  low REAL,
  high REAL,
  unit TEXT,
  normal_text TEXT,
  critical_low REAL,
  critical_high REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_samples (
  id SERIAL PRIMARY KEY,
  sample_id TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL,
  sample_type TEXT NOT NULL DEFAULT 'blood',
  status TEXT NOT NULL CHECK (status IN ('ordered','collected','received','processing','result_ready','delivered','rejected')) DEFAULT 'ordered',
  collected_at TEXT,
  collected_by_user_id INTEGER,
  received_at TEXT,
  received_by_user_id INTEGER,
  rejection_reason TEXT,
  recollect_required INTEGER NOT NULL DEFAULT 0,
  replaces_sample_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT now_iso(),
  updated_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_results (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  order_item_id INTEGER NOT NULL UNIQUE,
  test_id INTEGER NOT NULL,
  value_type TEXT NOT NULL CHECK (value_type IN ('numeric','text')) DEFAULT 'numeric',
  value_numeric REAL,
  value_text TEXT,
  unit TEXT,
  reference_range_id INTEGER,
  reference_display TEXT,
  flag TEXT CHECK (flag IN ('low','normal','high','critical')),
  comment TEXT,
  entered_by_user_id INTEGER,
  entered_at TEXT,
  created_at TEXT NOT NULL DEFAULT now_iso(),
  updated_at TEXT NOT NULL DEFAULT now_iso(),
  delta_flag INTEGER NOT NULL DEFAULT 0,
  critical_notified_at TEXT,
  critical_notified_by_user_id INTEGER,
  critical_notify_notes TEXT
);

CREATE TABLE IF NOT EXISTS lab_referring_doctors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  commission_percent REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_result_amendments (
  id SERIAL PRIMARY KEY,
  result_id INTEGER NOT NULL,
  old_value_numeric REAL,
  old_value_text TEXT,
  new_value_numeric REAL,
  new_value_text TEXT,
  reason TEXT,
  amended_by_user_id INTEGER NOT NULL,
  amended_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_home_collections (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  collector_user_id INTEGER,
  address TEXT,
  scheduled_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('assigned','collected','cancelled')) DEFAULT 'assigned',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT now_iso(),
  updated_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_equipment (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT,
  serial_no TEXT,
  location TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_equipment_maintenance (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL,
  maintenance_date TEXT NOT NULL DEFAULT today_iso(),
  next_due_date TEXT,
  performed_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_reagents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'ml',
  stock_qty REAL NOT NULL DEFAULT 0,
  low_stock_at REAL NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_reagent_batches (
  id SERIAL PRIMARY KEY,
  reagent_id INTEGER NOT NULL,
  batch_no TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  qty REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_reagent_movements (
  id SERIAL PRIMARY KEY,
  reagent_id INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('opening','adjustment','consumption')),
  qty_change REAL NOT NULL,
  qty_before REAL NOT NULL,
  qty_after REAL NOT NULL,
  reference_no TEXT,
  batch_id INTEGER,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_test_reagents (
  id SERIAL PRIMARY KEY,
  test_id INTEGER NOT NULL,
  reagent_id INTEGER NOT NULL,
  qty_per_test REAL NOT NULL DEFAULT 1,
  UNIQUE(test_id, reagent_id)
);

CREATE TABLE IF NOT EXISTS lab_organisms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lab_antibiotics (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lab_culture_organisms (
  id SERIAL PRIMARY KEY,
  order_item_id INTEGER NOT NULL,
  organism_id INTEGER NOT NULL,
  growth_count TEXT,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS lab_culture_sensitivities (
  id SERIAL PRIMARY KEY,
  culture_organism_id INTEGER NOT NULL,
  antibiotic_id INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('S','I','R')),
  UNIQUE(culture_organism_id, antibiotic_id)
);

CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  room_no TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL CHECK (room_type IN ('general','ac','non_ac','private','icu','semi_private')) DEFAULT 'general',
  floor TEXT,
  price_per_day REAL NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('available','occupied','maintenance')) DEFAULT 'available',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS admissions (
  id SERIAL PRIMARY KEY,
  admission_no TEXT NOT NULL UNIQUE,
  patient_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  doctor_id INTEGER,
  admitted_by_user_id INTEGER NOT NULL,
  diagnosis TEXT,
  admission_date TEXT NOT NULL,
  admission_time TEXT NOT NULL,
  discharge_date TEXT,
  discharge_time TEXT,
  days_stayed INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('admitted','discharged','transferred')) DEFAULT 'admitted',
  room_charge_total REAL NOT NULL DEFAULT 0,
  medicine_total REAL NOT NULL DEFAULT 0,
  lab_total REAL NOT NULL DEFAULT 0,
  procedure_total REAL NOT NULL DEFAULT 0,
  other_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
  payment_method TEXT CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')),
  notes TEXT,
  whatsapp_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT now_iso(),
  updated_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS admission_charges (
  id SERIAL PRIMARY KEY,
  admission_id INTEGER NOT NULL,
  charge_type TEXT NOT NULL CHECK (charge_type IN ('room','medicine','lab','procedure','doctor_fee','nursing','other')),
  description TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  charge_date TEXT NOT NULL DEFAULT today_iso(),
  ref_sale_id INTEGER,
  ref_order_id INTEGER,
  added_by_user_id INTEGER NOT NULL,
  auto_generated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS surgery_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  base_price REAL NOT NULL DEFAULT 0,
  description TEXT,
  duration_hrs REAL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT now_iso()
);

CREATE TABLE IF NOT EXISTS surgery_records (
  id SERIAL PRIMARY KEY,
  surgery_no TEXT NOT NULL UNIQUE,
  patient_id INTEGER NOT NULL,
  admission_id INTEGER,
  surgery_type_id INTEGER NOT NULL,
  surgeon_id INTEGER,
  anesthetist TEXT,
  surgery_date TEXT NOT NULL,
  surgery_time TEXT,
  duration_hrs REAL,
  theatre_no TEXT,
  diagnosis TEXT,
  procedure_notes TEXT,
  surgery_fee REAL NOT NULL DEFAULT 0,
  anesthesia_fee REAL NOT NULL DEFAULT 0,
  theatre_fee REAL NOT NULL DEFAULT 0,
  medicine_cost REAL NOT NULL DEFAULT 0,
  other_charges REAL NOT NULL DEFAULT 0,
  total_cost REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid','unpaid','partial')) DEFAULT 'unpaid',
  payment_method TEXT CHECK (payment_method IN ('cash','jazzcash','easypaisa','bank_transfer','card')),
  status TEXT NOT NULL CHECK (status IN ('scheduled','completed','cancelled')) DEFAULT 'scheduled',
  outcome TEXT,
  booked_by_user_id INTEGER NOT NULL,
  whatsapp_sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT now_iso(),
  updated_at TEXT NOT NULL DEFAULT now_iso()
);

-- ─── Foreign keys (added after all tables exist, so table order does not matter) ───

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT fk_users_doctor_id FOREIGN KEY (doctor_id) REFERENCES doctors(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE doctor_slots ADD CONSTRAINT fk_doctor_slots_doctor_id FOREIGN KEY (doctor_id) REFERENCES doctors(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT fk_appointments_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT fk_appointments_doctor_id FOREIGN KEY (doctor_id) REFERENCES doctors(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE appointments ADD CONSTRAINT fk_appointments_booked_by_user_id FOREIGN KEY (booked_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sales ADD CONSTRAINT fk_pharmacy_sales_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sales ADD CONSTRAINT fk_pharmacy_sales_sold_by_user_id FOREIGN KEY (sold_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sale_items ADD CONSTRAINT fk_pharmacy_sale_items_sale_id FOREIGN KEY (sale_id) REFERENCES pharmacy_sales(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sale_items ADD CONSTRAINT fk_pharmacy_sale_items_medicine_id FOREIGN KEY (medicine_id) REFERENCES medicines(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sale_items ADD CONSTRAINT fk_pharmacy_sale_items_batch_id FOREIGN KEY (batch_id) REFERENCES medicine_batches(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_medicine_id FOREIGN KEY (medicine_id) REFERENCES medicines(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_batch_id FOREIGN KEY (batch_id) REFERENCES medicine_batches(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_orders_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_orders_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_order_items ADD CONSTRAINT fk_purchase_order_items_po_id FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_order_items ADD CONSTRAINT fk_purchase_order_items_medicine_id FOREIGN KEY (medicine_id) REFERENCES medicines(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE medicine_batches ADD CONSTRAINT fk_medicine_batches_medicine_id FOREIGN KEY (medicine_id) REFERENCES medicines(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE medicine_batches ADD CONSTRAINT fk_medicine_batches_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE medicine_batches ADD CONSTRAINT fk_medicine_batches_purchase_order_id FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE medicine_batches ADD CONSTRAINT fk_medicine_batches_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE supplier_payments ADD CONSTRAINT fk_supplier_payments_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE supplier_payments ADD CONSTRAINT fk_supplier_payments_paid_by_user_id FOREIGN KEY (paid_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_returns ADD CONSTRAINT fk_purchase_returns_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_returns ADD CONSTRAINT fk_purchase_returns_po_id FOREIGN KEY (po_id) REFERENCES purchase_orders(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_returns ADD CONSTRAINT fk_purchase_returns_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_return_items ADD CONSTRAINT fk_purchase_return_items_return_id FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_return_items ADD CONSTRAINT fk_purchase_return_items_batch_id FOREIGN KEY (batch_id) REFERENCES medicine_batches(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE purchase_return_items ADD CONSTRAINT fk_purchase_return_items_medicine_id FOREIGN KEY (medicine_id) REFERENCES medicines(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sale_returns ADD CONSTRAINT fk_pharmacy_sale_returns_sale_id FOREIGN KEY (sale_id) REFERENCES pharmacy_sales(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sale_returns ADD CONSTRAINT fk_pharmacy_sale_returns_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sale_return_items ADD CONSTRAINT fk_pharmacy_sale_return_items_return_id FOREIGN KEY (return_id) REFERENCES pharmacy_sale_returns(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sale_return_items ADD CONSTRAINT fk_pharmacy_sale_return_items_sale_item_id FOREIGN KEY (sale_item_id) REFERENCES pharmacy_sale_items(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sale_return_items ADD CONSTRAINT fk_pharmacy_sale_return_items_medicine_id FOREIGN KEY (medicine_id) REFERENCES medicines(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pharmacy_sale_return_items ADD CONSTRAINT fk_pharmacy_sale_return_items_batch_id FOREIGN KEY (batch_id) REFERENCES medicine_batches(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE customer_credits ADD CONSTRAINT fk_customer_credits_sale_return_id FOREIGN KEY (sale_return_id) REFERENCES pharmacy_sale_returns(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE customer_credits ADD CONSTRAINT fk_customer_credits_redeemed_sale_id FOREIGN KEY (redeemed_sale_id) REFERENCES pharmacy_sales(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE customer_credits ADD CONSTRAINT fk_customer_credits_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_sale_id FOREIGN KEY (sale_id) REFERENCES pharmacy_sales(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE prescriptions ADD CONSTRAINT fk_prescriptions_uploaded_by_user_id FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_orders ADD CONSTRAINT fk_lab_orders_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_orders ADD CONSTRAINT fk_lab_orders_booked_by_user_id FOREIGN KEY (booked_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_orders ADD CONSTRAINT fk_lab_orders_reported_by_user_id FOREIGN KEY (reported_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_orders ADD CONSTRAINT fk_lab_orders_appointment_id FOREIGN KEY (appointment_id) REFERENCES appointments(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_orders ADD CONSTRAINT fk_lab_orders_admission_id FOREIGN KEY (admission_id) REFERENCES admissions(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_orders ADD CONSTRAINT fk_lab_orders_reviewed_by_user_id FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_orders ADD CONSTRAINT fk_lab_orders_referring_doctor_id FOREIGN KEY (referring_doctor_id) REFERENCES lab_referring_doctors(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_order_items ADD CONSTRAINT fk_lab_order_items_order_id FOREIGN KEY (order_id) REFERENCES lab_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_order_items ADD CONSTRAINT fk_lab_order_items_test_id FOREIGN KEY (test_id) REFERENCES lab_tests(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_order_items ADD CONSTRAINT fk_lab_order_items_order_panel_id FOREIGN KEY (order_panel_id) REFERENCES lab_order_panels(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_order_items ADD CONSTRAINT fk_lab_order_items_sample_id FOREIGN KEY (sample_id) REFERENCES lab_samples(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_order_items ADD CONSTRAINT fk_lab_order_items_assigned_technician_id FOREIGN KEY (assigned_technician_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_panel_tests ADD CONSTRAINT fk_lab_panel_tests_panel_id FOREIGN KEY (panel_id) REFERENCES lab_panels(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_panel_tests ADD CONSTRAINT fk_lab_panel_tests_test_id FOREIGN KEY (test_id) REFERENCES lab_tests(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_order_panels ADD CONSTRAINT fk_lab_order_panels_order_id FOREIGN KEY (order_id) REFERENCES lab_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_order_panels ADD CONSTRAINT fk_lab_order_panels_panel_id FOREIGN KEY (panel_id) REFERENCES lab_panels(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_test_reference_ranges ADD CONSTRAINT fk_lab_test_reference_ranges_test_id FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_samples ADD CONSTRAINT fk_lab_samples_order_id FOREIGN KEY (order_id) REFERENCES lab_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_samples ADD CONSTRAINT fk_lab_samples_collected_by_user_id FOREIGN KEY (collected_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_samples ADD CONSTRAINT fk_lab_samples_received_by_user_id FOREIGN KEY (received_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_samples ADD CONSTRAINT fk_lab_samples_replaces_sample_id FOREIGN KEY (replaces_sample_id) REFERENCES lab_samples(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_results ADD CONSTRAINT fk_lab_results_order_id FOREIGN KEY (order_id) REFERENCES lab_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_results ADD CONSTRAINT fk_lab_results_order_item_id FOREIGN KEY (order_item_id) REFERENCES lab_order_items(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_results ADD CONSTRAINT fk_lab_results_test_id FOREIGN KEY (test_id) REFERENCES lab_tests(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_results ADD CONSTRAINT fk_lab_results_reference_range_id FOREIGN KEY (reference_range_id) REFERENCES lab_test_reference_ranges(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_results ADD CONSTRAINT fk_lab_results_entered_by_user_id FOREIGN KEY (entered_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_results ADD CONSTRAINT fk_lab_results_critical_notified_by_user_id FOREIGN KEY (critical_notified_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_result_amendments ADD CONSTRAINT fk_lab_result_amendments_result_id FOREIGN KEY (result_id) REFERENCES lab_results(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_result_amendments ADD CONSTRAINT fk_lab_result_amendments_amended_by_user_id FOREIGN KEY (amended_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_home_collections ADD CONSTRAINT fk_lab_home_collections_order_id FOREIGN KEY (order_id) REFERENCES lab_orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_home_collections ADD CONSTRAINT fk_lab_home_collections_collector_user_id FOREIGN KEY (collector_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_equipment_maintenance ADD CONSTRAINT fk_lab_equipment_maintenance_equipment_id FOREIGN KEY (equipment_id) REFERENCES lab_equipment(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_reagent_batches ADD CONSTRAINT fk_lab_reagent_batches_reagent_id FOREIGN KEY (reagent_id) REFERENCES lab_reagents(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_reagent_batches ADD CONSTRAINT fk_lab_reagent_batches_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_reagent_movements ADD CONSTRAINT fk_lab_reagent_movements_reagent_id FOREIGN KEY (reagent_id) REFERENCES lab_reagents(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_reagent_movements ADD CONSTRAINT fk_lab_reagent_movements_batch_id FOREIGN KEY (batch_id) REFERENCES lab_reagent_batches(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_reagent_movements ADD CONSTRAINT fk_lab_reagent_movements_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_test_reagents ADD CONSTRAINT fk_lab_test_reagents_test_id FOREIGN KEY (test_id) REFERENCES lab_tests(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_test_reagents ADD CONSTRAINT fk_lab_test_reagents_reagent_id FOREIGN KEY (reagent_id) REFERENCES lab_reagents(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_culture_organisms ADD CONSTRAINT fk_lab_culture_organisms_order_item_id FOREIGN KEY (order_item_id) REFERENCES lab_order_items(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_culture_organisms ADD CONSTRAINT fk_lab_culture_organisms_organism_id FOREIGN KEY (organism_id) REFERENCES lab_organisms(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_culture_sensitivities ADD CONSTRAINT fk_lab_culture_sensitivities_culture_organism_id FOREIGN KEY (culture_organism_id) REFERENCES lab_culture_organisms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE lab_culture_sensitivities ADD CONSTRAINT fk_lab_culture_sensitivities_antibiotic_id FOREIGN KEY (antibiotic_id) REFERENCES lab_antibiotics(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE admissions ADD CONSTRAINT fk_admissions_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE admissions ADD CONSTRAINT fk_admissions_room_id FOREIGN KEY (room_id) REFERENCES rooms(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE admissions ADD CONSTRAINT fk_admissions_doctor_id FOREIGN KEY (doctor_id) REFERENCES doctors(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE admissions ADD CONSTRAINT fk_admissions_admitted_by_user_id FOREIGN KEY (admitted_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE admission_charges ADD CONSTRAINT fk_admission_charges_admission_id FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE admission_charges ADD CONSTRAINT fk_admission_charges_added_by_user_id FOREIGN KEY (added_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE surgery_records ADD CONSTRAINT fk_surgery_records_patient_id FOREIGN KEY (patient_id) REFERENCES patients(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE surgery_records ADD CONSTRAINT fk_surgery_records_admission_id FOREIGN KEY (admission_id) REFERENCES admissions(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE surgery_records ADD CONSTRAINT fk_surgery_records_surgery_type_id FOREIGN KEY (surgery_type_id) REFERENCES surgery_types(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE surgery_records ADD CONSTRAINT fk_surgery_records_surgeon_id FOREIGN KEY (surgeon_id) REFERENCES doctors(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE surgery_records ADD CONSTRAINT fk_surgery_records_booked_by_user_id FOREIGN KEY (booked_by_user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Indexes ───

CREATE INDEX IF NOT EXISTS idx_doctor_slots_doctor ON doctor_slots(doctor_id, slot_time);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_pharm_sales_date ON pharmacy_sales(created_at);
CREATE INDEX IF NOT EXISTS idx_pharm_sale_items ON pharmacy_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_medicine ON stock_movements(medicine_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date     ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po  ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_medicine_batches_medicine ON medicine_batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicine_batches_expiry   ON medicine_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_sale_returns_sale        ON pharmacy_sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_sale_return_items_return ON pharmacy_sale_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_customer_credits_phone ON customer_credits(phone);
CREATE INDEX IF NOT EXISTS idx_prescriptions_sale    ON prescriptions(sale_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_date    ON lab_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_order_items    ON lab_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_lab_panel_tests_panel ON lab_panel_tests(panel_id);
CREATE INDEX IF NOT EXISTS idx_lab_order_panels_order ON lab_order_panels(order_id);
CREATE INDEX IF NOT EXISTS idx_lab_ref_ranges_test ON lab_test_reference_ranges(test_id);
CREATE INDEX IF NOT EXISTS idx_lab_samples_order ON lab_samples(order_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_order ON lab_results(order_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_test  ON lab_results(test_id);
CREATE INDEX IF NOT EXISTS idx_lab_result_amendments_result ON lab_result_amendments(result_id);
CREATE INDEX IF NOT EXISTS idx_lab_home_collections_order ON lab_home_collections(order_id);
CREATE INDEX IF NOT EXISTS idx_lab_equip_maint_equipment ON lab_equipment_maintenance(equipment_id);
CREATE INDEX IF NOT EXISTS idx_lab_equip_maint_due ON lab_equipment_maintenance(next_due_date);
CREATE INDEX IF NOT EXISTS idx_lab_reagent_batches_reagent ON lab_reagent_batches(reagent_id);
CREATE INDEX IF NOT EXISTS idx_lab_reagent_batches_expiry  ON lab_reagent_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_lab_reagent_movements_reagent ON lab_reagent_movements(reagent_id);
CREATE INDEX IF NOT EXISTS idx_lab_culture_org_item ON lab_culture_organisms(order_item_id);
CREATE INDEX IF NOT EXISTS idx_admissions_patient  ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_status   ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admission_charges   ON admission_charges(admission_id, charge_date);
CREATE INDEX IF NOT EXISTS idx_surgery_patient ON surgery_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_surgery_date    ON surgery_records(surgery_date);
