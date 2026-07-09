import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const db = getDb();
    const id = Number(params.id);
    const b = await req.json();
    const fields: Record<string, any> = {
      name: b.name, phone: b.phone,
      commission_percent: b.commission_percent !== undefined ? Number(b.commission_percent) : undefined
    };
    if (typeof b.active === 'boolean') fields.active = b.active ? 1 : 0;
    const updates = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
    const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
    if (!updates.length) return fail('Nothing to update.');
    db.prepare(`UPDATE lab_referring_doctors SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
    return ok({ updated: true });
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const db = getDb();
    const id = Number(params.id);
    const used = db.prepare(`SELECT COUNT(*) AS c FROM lab_orders WHERE referring_doctor_id = ?`).get(id) as { c: number };
    if (used.c > 0) {
      db.prepare(`UPDATE lab_referring_doctors SET active = 0 WHERE id = ?`).run(id);
      return ok({ deactivated: true });
    }
    db.prepare(`DELETE FROM lab_referring_doctors WHERE id = ?`).run(id);
    return ok({ deleted: true });
  } catch (err) { return handleApiError(err); }
}
