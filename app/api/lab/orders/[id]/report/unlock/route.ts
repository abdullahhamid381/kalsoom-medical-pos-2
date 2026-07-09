import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const db = getDb();
    const id = Number(params.id);
    const order = db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id) as any;
    if (!order) return fail('Order not found.', 404);
    if (order.report_status !== 'reported') return fail('Report is not finalized.');

    // Unlocking a finalized report also clears the review stamp — it must be re-reviewed
    // by a senior technologist before a pathologist can finalize it again.
    db.prepare(
      `UPDATE lab_orders SET report_status = 'entered', reviewed_by_user_id = NULL, reviewed_at = NULL WHERE id = ?`
    ).run(id);
    const updated = db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id);
    return ok({ order: updated });
  } catch (err) { return handleApiError(err); }
}
