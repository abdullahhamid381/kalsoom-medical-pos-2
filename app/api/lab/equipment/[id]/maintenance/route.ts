import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
        const db = await getDb();
        const equipmentId = Number(params.id);
        const equipment = await db.prepare(`SELECT id FROM lab_equipment WHERE id = ?`).get(equipmentId);
        if (!equipment)
            return fail('Equipment not found.', 404);
        const b = await req.json();
        const result = await db.prepare(`INSERT INTO lab_equipment_maintenance (equipment_id, maintenance_date, next_due_date, performed_by, notes)
       VALUES (?, ?, ?, ?, ?)`).run(equipmentId, b.maintenance_date || new Date().toISOString().slice(0, 10), b.next_due_date || null, b.performed_by || null, b.notes || null);
        return ok({ id: result.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
