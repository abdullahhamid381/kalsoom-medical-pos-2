import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        await requireRole('super_admin', 'receptionist', 'receptionist_admin');
        const db = await getDb();
        const q = req.nextUrl.searchParams.get('q')?.trim();
        let patients;
        if (q) {
            patients = await db
                .prepare(`SELECT * FROM patients WHERE full_name LIKE ? OR phone LIKE ? OR cnic LIKE ? ORDER BY created_at DESC LIMIT 50`)
                .all(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        else {
            patients = await db.prepare(`SELECT * FROM patients ORDER BY created_at DESC LIMIT 50`).all();
        }
        return ok({ patients });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        await requireRole('super_admin', 'receptionist', 'receptionist_admin');
        const body = await req.json();
        const full_name = String(body.full_name || '').trim();
        const phone = String(body.phone || '').trim();
        const cnic = body.cnic ? String(body.cnic).trim() : null;
        const age = body.age ? Number(body.age) : null;
        const gender = ['Male', 'Female', 'Other'].includes(body.gender) ? body.gender : 'Other';
        const address = body.address ? String(body.address).trim() : null;
        if (!full_name || !phone)
            return fail('Patient name and phone number are required.');
        const db = await getDb();
        const result = await db
            .prepare(`INSERT INTO patients (full_name, phone, cnic, age, gender, address) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(full_name, phone, cnic, age, gender, address);
        const patient = await db.prepare(`SELECT * FROM patients WHERE id = ?`).get(result.lastInsertRowid);
        return ok({ patient }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
