import { NextRequest } from 'next/server';
import crypto from 'crypto';
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
        const session = await requireRole('super_admin', 'lab_pathologist');
        const db = await getDb();
        const id = Number(params.id);
        const order = await db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id) as any;
        if (!order)
            return fail('Order not found.', 404);
        if (order.report_status === 'reported')
            return fail('Report is already finalized.');
        if (order.report_status !== 'reviewed') {
            return fail('Results must be reviewed by a senior technologist before finalizing.');
        }
        const token = crypto.randomBytes(12).toString('hex');
        await db.prepare(`UPDATE lab_orders SET report_status = 'reported', reported_by_user_id = ?, reported_at = now_iso(),
         verification_token = ?, status = CASE WHEN status IN ('pending','processing') THEN 'completed' ELSE status END
       WHERE id = ?`).run(session.id, token, id);
        const updated = await db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id);
        return ok({ order: updated });
    }
    catch (err) {
        return handleApiError(err);
    }
}
