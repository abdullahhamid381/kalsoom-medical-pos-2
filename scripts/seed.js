/**
 * Optional manual setup script.
 *
 * Run with: npm run seed
 *
 * NOTE: the app now also runs this same bootstrap automatically the first
 * time it starts (see lib/db.ts + lib/seed.ts), so this script is no longer
 * required - it's kept around for cases where you want to create the schema
 * and see the admin credentials printed before starting the server at all.
 *
 * - Connects to the Postgres database at DATABASE_URL (Neon or any Postgres).
 * - Creates tables if they don't already exist (never deletes existing data).
 * - Creates the first super admin account from the values in your .env file.
 * - Adds a few sample doctors so the app isn't empty on first run.
 *
 * Safe to re-run: it will skip creating the admin/doctors if they already exist.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add your Postgres/Neon connection string to .env first.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const schema = fs.readFileSync(path.join(__dirname, '..', 'lib', 'schema.pg.sql'), 'utf-8');
  await pool.query(schema);

  const adminUsername = (process.env.SUPER_ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const adminName = process.env.SUPER_ADMIN_NAME || 'Kalsoom Admin';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345';

  const existingAdmin = await pool.query('SELECT id FROM users WHERE username = $1', [adminUsername]);
  if (existingAdmin.rows.length > 0) {
    console.log(`Super admin "${adminUsername}" already exists - skipping.`);
  } else {
    const hash = bcrypt.hashSync(adminPassword, 10);
    await pool.query(
      'INSERT INTO users (name, username, password_hash, role) VALUES ($1, $2, $3, $4)',
      [adminName, adminUsername, hash, 'super_admin']
    );
    console.log(`Created super admin account:`);
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('  (You can change this password later from inside the app.)');
  }

  const doctorCount = Number((await pool.query('SELECT COUNT(*) AS c FROM doctors')).rows[0].c);
  if (doctorCount === 0) {
    const sampleDoctors = [
      ['Dr. Asad Mahmood', 'General Physician', 'General Medicine', 500, 'Mon-Sat, 9:00 AM - 2:00 PM'],
      ['Dr. Sana Iqbal', 'Gynecologist', 'Gynecology', 1000, 'Mon-Fri, 4:00 PM - 8:00 PM'],
      ['Dr. Bilal Hussain', 'Cardiologist', 'Cardiology', 1500, 'Tue, Thu, Sat, 5:00 PM - 9:00 PM'],
      ['Dr. Mehwish Tariq', 'Pediatrician', 'Pediatrics', 800, 'Mon-Sat, 10:00 AM - 1:00 PM'],
      ['Dr. Imran Qureshi', 'Orthopedic Surgeon', 'Orthopedics', 1200, 'Mon, Wed, Fri, 3:00 PM - 7:00 PM']
    ];
    for (const d of sampleDoctors) {
      await pool.query(
        'INSERT INTO doctors (name, specialization, department, fee, availability) VALUES ($1, $2, $3, $4, $5)',
        d
      );
    }
    console.log(`Added ${sampleDoctors.length} sample doctors. You can edit/remove these from Dashboard > Doctors.`);
  } else {
    console.log('Doctors already exist - skipping sample doctors.');
  }

  console.log('\nDatabase ready (Postgres/Neon).');
  console.log('Setup complete. Run "npm run dev" (or "npm run build && npm start") and log in.');
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
