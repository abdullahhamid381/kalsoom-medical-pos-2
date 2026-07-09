import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const id = Number(params.id);
    const body = await req.json();
    const db = getDb();

    const updates: string[] = [];
    const values: any[] = [];
    const fields: Record<string, string> = {
      name: 'name',
      specialization: 'specialization',
      department: 'department',
      availability: 'availability',
      phone: 'phone',
      description: 'description'
    };
    for (const key of Object.keys(fields)) {
      if (typeof body[key] === 'string') {
        updates.push(`${fields[key]} = ?`);
        values.push(body[key].trim());
      }
    }
    if (body.fee !== undefined) {
      updates.push('fee = ?');
      values.push(Number(body.fee));
    }
    if (typeof body.active === 'boolean') {
      updates.push('active = ?');
      values.push(body.active ? 1 : 0);
    }
    if (updates.length === 0) return fail('Nothing to update.');

    db.prepare(`UPDATE doctors SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
    return ok({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const id = Number(params.id);
    const db = getDb();

    const bookingCount = db.prepare(`SELECT COUNT(*) AS c FROM appointments WHERE doctor_id = ?`).get(id) as {
      c: number;
    };
    if (bookingCount.c > 0) {
      db.prepare(`UPDATE doctors SET active = 0 WHERE id = ?`).run(id);
      return ok({ deactivated: true, reason: 'This doctor has existing appointments, so they were deactivated instead of deleted to preserve appointment history.' });
    }

    db.prepare(`DELETE FROM doctors WHERE id = ?`).run(id);
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
