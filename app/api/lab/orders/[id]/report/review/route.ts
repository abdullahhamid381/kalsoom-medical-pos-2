import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function POST(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireRole('super_admin', 'lab_senior_technologist');
        const db = await getDb();
        const id = Number(params.id);
        const order = await db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id) as any;
        if (!order)
            return fail('Order not found.', 404);
        if (order.report_status !== 'entered')
            return fail('Only reports with entered results can be marked reviewed.');
        const missing = await db.prepare(`SELECT COUNT(*) AS c FROM lab_order_items loi LEFT JOIN lab_results lr ON lr.order_item_id = loi.id
       WHERE loi.order_id = ? AND lr.id IS NULL`).get(id) as {
            c: number;
        };
        if (missing.c > 0)
            return fail('Enter results for every test before marking the report reviewed.');
        await db.prepare(`UPDATE lab_orders SET report_status = 'reviewed', reviewed_by_user_id = ?, reviewed_at = now_iso() WHERE id = ?`).run(session.id, id);
        const updated = await db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id);
        return ok({ order: updated });
    }
    catch (err) {
        return handleApiError(err);
    }
}
