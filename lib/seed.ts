import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Creates the first Super Admin account and a few sample doctors, but only
// if they don't already exist. Safe to call on every server start - this is
// what lets the app bootstrap itself with zero manual steps on platforms
// like Railway, where a fresh container with an empty mounted volume needs
// to become a working app the moment it starts, with no separate "ssh in
// and run a setup script" step available.
// ---------------------------------------------------------------------------

export function runSeed(db: Database.Database) {
  const adminUsername = (process.env.SUPER_ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const adminName = process.env.SUPER_ADMIN_NAME || 'Kalsoom Admin';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@12345';

  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare('INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)').run(
      adminName,
      adminUsername,
      hash,
      'super_admin'
    );
    console.log(`[kalsoom] Created super admin account "${adminUsername}". Change the password after first login.`);
  }

  const doctorCount = (db.prepare('SELECT COUNT(*) AS c FROM doctors').get() as { c: number }).c;
  if (doctorCount === 0) {
    const sampleDoctors: [string, string, string, number, string][] = [
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
    console.log(`[kalsoom] Added ${sampleDoctors.length} sample doctors (edit/remove from Dashboard > Doctors).`);
  }
}
