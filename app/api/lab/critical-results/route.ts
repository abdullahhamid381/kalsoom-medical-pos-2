import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const results = await db.prepare(`
      SELECT lr.id, lr.order_id, lo.order_no, lo.patient_name, lr.test_id, loi.test_name,
             lr.value_numeric, lr.value_text, lr.unit, lr.entered_at
      FROM lab_results lr
      JOIN lab_orders lo ON lo.id = lr.order_id
      JOIN lab_order_items loi ON loi.id = lr.order_item_id
      WHERE lr.flag = 'critical' AND lr.critical_notified_at IS NULL
      ORDER BY lr.entered_at DESC LIMIT 50
    `).all();
        return ok({ results });
    }
    catch (err) {
        return handleApiError(err);
    }
}
