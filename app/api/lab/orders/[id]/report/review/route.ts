import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole('super_admin', 'lab_senior_technologist');
    const db = getDb();
    const id = Number(params.id);
    const order = db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id) as any;
    if (!order) return fail('Order not found.', 404);
    if (order.report_status !== 'entered') return fail('Only reports with entered results can be marked reviewed.');

    const missing = db.prepare(
      `SELECT COUNT(*) AS c FROM lab_order_items loi LEFT JOIN lab_results lr ON lr.order_item_id = loi.id
       WHERE loi.order_id = ? AND lr.id IS NULL`
    ).get(id) as { c: number };
    if (missing.c > 0) return fail('Enter results for every test before marking the report reviewed.');

    db.prepare(
      `UPDATE lab_orders SET report_status = 'reviewed', reviewed_by_user_id = ?, reviewed_at = datetime('now') WHERE id = ?`
    ).run(session.id, id);

    const updated = db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id);
    return ok({ order: updated });
  } catch (err) { return handleApiError(err); }
}
