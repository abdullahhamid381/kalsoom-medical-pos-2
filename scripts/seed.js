/**
 * Optional manual setup script.
 *
 * Run with: npm run seed
 *
 * NOTE: the app now also runs this same bootstrap automatically the first
 * time it starts (see lib/seed.ts), so this script is no longer required -
 * it's kept around for cases where you want to create the database and see
 * the admin credentials printed before starting the server at all (e.g. on
 * a fresh local machine, before running `npm run dev`).
 *
 * - Creates the data/ folder and the SQLite database file (permanent, on disk).
 * - Creates tables if they don't already exist (never deletes existing data).
 * - Creates the first super admin account from the values in your .env file.
 * - Adds a few sample doctors so the app isn't empty on first run.
 *
 * Safe to re-run: it will skip creating the admin/doctors if they already exist.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dbPathConfig = process.env.DATABASE_PATH || './data/kalsoom.db';
const dbPath = path.isAbsolute(dbPathConfig) ? dbPathConfig : path.join(process.cwd(), dbPathConfig);
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, '..', 'lib', 'schema.sql'), 'utf-8');
db.exec(schema);

function main() {
  const adminUsername = (process.env.SUPER_ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const adminName = process.env.SUPER_ADMIN_NAME || 'Kalsoom Admin';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345';

  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
  if (existingAdmin) {
    console.log(`Super admin "${adminUsername}" already exists - skipping.`);
  } else {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare(
      'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(adminName, adminUsername, hash, 'super_admin');
    console.log(`Created super admin account:`);
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('  (You can change this password later from inside the app.)');
  }

  const doctorCount = db.prepare('SELECT COUNT(*) AS c FROM doctors').get().c;
  if (doctorCount === 0) {
    const sampleDoctors = [
      ['Dr. Asad Mahmood', 'General Physician', 'General Medicine', 500, 'Mon-Sat, 9:00 AM - 2:00 PM'],
      ['Dr. Sana Iqbal', 'Gynecologist', 'Gynecology', 1000, 'Mon-Fri, 4:00 PM - 8:00 PM'],
      ['Dr. Bilal Hussain', 'Cardiologist', 'Cardiology', 1500, 'Tue, Thu, Sat, 5:00 PM - 9:00 PM'],
      ['Dr. Mehwish Tariq', 'Pediatrician', 'Pediatrics', 800, 'Mon-Sat, 10:00 AM - 1:00 PM'],
      ['Dr. Imran Qureshi', 'Orthopedic Surgeon', 'Orthopedics', 1200, 'Mon, Wed, Fri, 3:00 PM - 7:00 PM']
    ];
    const insert = db.prepare(
      'INSERT INTO doctors (name, specialization, department, fee, availability) VALUES (?, ?, ?, ?, ?)'
    );
    for (const d of sampleDoctors) insert.run(...d);
    console.log(`Added ${sampleDoctors.length} sample doctors. You can edit/remove these from Dashboard > Doctors.`);
  } else {
    console.log('Doctors already exist - skipping sample doctors.');
  }

  console.log('\nDatabase ready at:', dbPath);
  console.log('Setup complete. Run "npm run dev" (or "npm run build && npm start") and log in.');
}

main();
db.close();
