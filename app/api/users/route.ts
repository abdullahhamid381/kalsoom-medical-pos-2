import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, hashPassword } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
const ROLES = ['super_admin', 'receptionist', 'receptionist_admin', 'doctor', 'pharmacy_admin', 'sales_person', 'lab_technician', 'ward_admin', 'lab_senior_technologist', 'lab_pathologist'];
export async function GET() {
    try {
        const session = await requireRole('super_admin', 'receptionist_admin');
        const db = await getDb();
        // A receptionist_admin only manages receptionist accounts - hide every other login.
        const roleFilter = session.role === 'receptionist_admin' ? `WHERE u.role = 'receptionist'` : '';
        const users = await db
            .prepare(`SELECT u.id, u.name, u.username, u.role, u.active, u.created_at, u.doctor_id,
                d.name AS doctor_name
         FROM users u
         LEFT JOIN doctors d ON d.id = u.doctor_id
         ${roleFilter}
         ORDER BY u.created_at DESC`)
            .all();
        return ok({ users });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        const session = await requireRole('super_admin', 'receptionist_admin');
        const body = await req.json();
        const name = String(body.name || '').trim();
        const username = String(body.username || '').trim().toLowerCase();
        const password = String(body.password || '');
        // A receptionist_admin can only ever create receptionist logins.
        const role = session.role === 'receptionist_admin' ? 'receptionist' : ROLES.includes(body.role) ? body.role : 'receptionist';
        if (!name || !username || !password)
            return fail('Name, username and password are required.');
        if (password.length < 6)
            return fail('Password must be at least 6 characters.');
        const db = await getDb();
        let doctorId: number | null = null;
        if (role === 'doctor') {
            doctorId = Number(body.doctor_id);
            if (!doctorId)
                return fail('Select which doctor this login belongs to.');
            const doctor = await db.prepare(`SELECT id FROM doctors WHERE id = ?`).get(doctorId);
            if (!doctor)
                return fail('Selected doctor was not found.');
            const alreadyLinked = await db.prepare(`SELECT id FROM users WHERE doctor_id = ?`).get(doctorId);
            if (alreadyLinked)
                return fail('This doctor already has a login account.');
        }
        const exists = await db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
        if (exists)
            return fail('That username is already taken.');
        const password_hash = await hashPassword(password);
        const result = await db
            .prepare(`INSERT INTO users (name, username, password_hash, role, doctor_id) VALUES (?, ?, ?, ?, ?)`)
            .run(name, username, password_hash, role, doctorId);
        return ok({ id: result.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
