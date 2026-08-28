import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(req: NextRequest) {
    try {
        await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
        const db = await getDb();
        const all = req.nextUrl.searchParams.get('all') === '1';
        const where = all ? '' : 'WHERE active = 1';
        const equipment = await db.prepare(`SELECT * FROM lab_equipment ${where} ORDER BY name ASC`).all() as any[];
        const dueSoon = await db.prepare(`
      SELECT e.id AS equipment_id, e.name, MAX(m.next_due_date) AS next_due_date
      FROM lab_equipment e JOIN lab_equipment_maintenance m ON m.equipment_id = e.id
      WHERE e.active = 1 AND m.next_due_date IS NOT NULL AND m.next_due_date <= today_plus_iso(14)
      GROUP BY e.id
    `).all();
        for (const e of equipment) {
            e.maintenance = await db.prepare(`SELECT * FROM lab_equipment_maintenance WHERE equipment_id = ? ORDER BY maintenance_date DESC`).all(e.id);
        }
        return ok({ equipment, dueSoon });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        await requireRole('super_admin');
        const b = await req.json();
        const name = String(b.name || '').trim();
        if (!name)
            return fail('Equipment name is required.');
        const db = await getDb();
        const result = await db.prepare(`INSERT INTO lab_equipment (name, model, serial_no, location) VALUES (?, ?, ?, ?)`).run(name, b.model || null, b.serial_no || null, b.location || null);
        return ok({ id: result.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
