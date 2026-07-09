import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function PUT(req: NextRequest) {
  try {
    const session = await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
    const db = getDb();
    const b = await req.json();
    const orderItemId = Number(b.order_item_id);
    if (!orderItemId) return fail('order_item_id is required.');
    const item = db.prepare(`SELECT * FROM lab_order_items WHERE id = ?`).get(orderItemId) as any;
    if (!item) return fail('Item not found.', 404);

    let technicianId: number | null = b.technician_id != null ? Number(b.technician_id) : null;
    // Plain technicians may only assign themselves; senior technologists/super_admin can assign anyone.
    if (session.role === 'lab_technician' && technicianId !== null && technicianId !== session.id) {
      return fail('Technicians can only assign work to themselves.', 403);
    }

    db.prepare(`UPDATE lab_order_items SET assigned_technician_id = ? WHERE id = ?`).run(technicianId, orderItemId);
    return ok({ assigned: true });
  } catch (err) { return handleApiError(err); }
}
