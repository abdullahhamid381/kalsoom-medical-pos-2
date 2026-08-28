import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
const STATUSES = ['ordered', 'collected', 'received', 'processing', 'result_ready', 'delivered', 'rejected'];
export async function PUT(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireRole('super_admin', 'lab_technician');
        const db = await getDb();
        const id = Number(params.id);
        const sample = await db.prepare(`SELECT * FROM lab_samples WHERE id = ?`).get(id) as any;
        if (!sample)
            return fail('Sample not found.', 404);
        const b = await req.json();
        if (!STATUSES.includes(b.status))
            return fail('Invalid status.');
        if (b.status === 'rejected' && !String(b.rejection_reason || '').trim()) {
            return fail('A rejection reason is required.');
        }
        const updates: string[] = ['status = ?', "updated_at = now_iso()"];
        const vals: any[] = [b.status];
        if (b.status === 'collected' && !sample.collected_at) {
            updates.push('collected_at = now_iso()', 'collected_by_user_id = ?');
            vals.push(session.id);
        }
        if (b.status === 'received' && !sample.received_at) {
            updates.push('received_at = now_iso()', 'received_by_user_id = ?');
            vals.push(session.id);
        }
        if (b.status === 'rejected') {
            updates.push('rejection_reason = ?', 'recollect_required = ?');
            vals.push(String(b.rejection_reason), b.recollect_required === false ? 0 : 1);
        }
        await db.prepare(`UPDATE lab_samples SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        // First sample collected bumps the parent order from pending -> processing.
        if (b.status === 'collected') {
            await db.prepare(`UPDATE lab_orders SET status = 'processing' WHERE id = ? AND status = 'pending'`).run(sample.order_id);
        }
        const updated = await db.prepare(`SELECT * FROM lab_samples WHERE id = ?`).get(id);
        return ok({ sample: updated });
    }
    catch (err) {
        return handleApiError(err);
    }
}
