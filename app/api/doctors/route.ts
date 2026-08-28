import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { replaceSlots } from '@/lib/doctor-slots';
export async function GET() {
    try {
        await requireSession();
        const db = await getDb();
        const doctors = await db.prepare(`SELECT * FROM doctors ORDER BY active DESC, name ASC`).all() as any[];
        const slotStmt = db.prepare(`SELECT slot_time FROM doctor_slots WHERE doctor_id = ? ORDER BY slot_time ASC`);
        for (const d of doctors) {
            d.slots = (await slotStmt.all(d.id)).map((r: any) => r.slot_time);
        }
        return ok({ doctors });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        await requireRole('super_admin', 'receptionist_admin');
        const body = await req.json();
        const name = String(body.name || '').trim();
        const specialization = String(body.specialization || '').trim();
        const department = String(body.department || 'General').trim();
        const fee = Number(body.fee || 0);
        const availability = String(body.availability || 'Mon-Sat, 9:00 AM - 5:00 PM').trim();
        const phone = body.phone ? String(body.phone).trim() : null;
        const description = body.description ? String(body.description).trim() : null;
        if (!name || !specialization)
            return fail('Doctor name and specialization are required.');
        const db = await getDb();
        const result = await db
            .prepare(`INSERT INTO doctors (name, specialization, department, fee, availability, phone, description) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(name, specialization, department, fee, availability, phone, description);
        await replaceSlots(db, Number(result.lastInsertRowid), body.slots);
        return ok({ id: result.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
