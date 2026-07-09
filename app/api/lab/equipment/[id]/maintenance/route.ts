import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
    const db = getDb();
    const equipmentId = Number(params.id);
    const equipment = db.prepare(`SELECT id FROM lab_equipment WHERE id = ?`).get(equipmentId);
    if (!equipment) return fail('Equipment not found.', 404);
    const b = await req.json();
    const result = db.prepare(
      `INSERT INTO lab_equipment_maintenance (equipment_id, maintenance_date, next_due_date, performed_by, notes)
       VALUES (?, ?, ?, ?, ?)`
    ).run(equipmentId, b.maintenance_date || new Date().toISOString().slice(0, 10), b.next_due_date || null, b.performed_by || null, b.notes || null);
    return ok({ id: result.lastInsertRowid }, 201);
  } catch (err) { return handleApiError(err); }
}
