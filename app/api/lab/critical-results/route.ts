import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';

export async function GET(_req: NextRequest) {
  try {
    await requireSession();
    const db = getDb();
    const results = db.prepare(`
      SELECT lr.id, lr.order_id, lo.order_no, lo.patient_name, lr.test_id, loi.test_name,
             lr.value_numeric, lr.value_text, lr.unit, lr.entered_at
      FROM lab_results lr
      JOIN lab_orders lo ON lo.id = lr.order_id
      JOIN lab_order_items loi ON loi.id = lr.order_item_id
      WHERE lr.flag = 'critical' AND lr.critical_notified_at IS NULL
      ORDER BY lr.entered_at DESC LIMIT 50
    `).all();
    return ok({ results });
  } catch (err) { return handleApiError(err); }
}
