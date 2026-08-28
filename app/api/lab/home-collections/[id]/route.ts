import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
const STATUSES = ['assigned', 'collected', 'cancelled'];
export async function PUT(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
        const db = await getDb();
        const id = Number(params.id);
        const existing = await db.prepare(`SELECT * FROM lab_home_collections WHERE id = ?`).get(id) as any;
        if (!existing)
            return fail('Home collection not found.', 404);
        const b = await req.json();
        const updates: string[] = [];
        const vals: any[] = [];
        if (STATUSES.includes(b.status)) {
            updates.push('status = ?');
            vals.push(b.status);
        }
        if (b.collector_user_id !== undefined) {
            updates.push('collector_user_id = ?');
            vals.push(b.collector_user_id ? Number(b.collector_user_id) : null);
        }
        if (b.scheduled_at !== undefined) {
            updates.push('scheduled_at = ?');
            vals.push(b.scheduled_at || null);
        }
        if (b.address !== undefined) {
            updates.push('address = ?');
            vals.push(b.address || null);
        }
        if (b.notes !== undefined) {
            updates.push('notes = ?');
            vals.push(b.notes || null);
        }
        if (!updates.length)
            return fail('Nothing to update.');
        updates.push("updated_at = now_iso()");
        await db.prepare(`UPDATE lab_home_collections SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        // Collecting at home kicks off the same sample lifecycle a lab-collected sample would.
        if (b.status === 'collected') {
            await db.prepare(`UPDATE lab_samples SET status = 'collected', collected_at = now_iso() WHERE order_id = ? AND status = 'ordered'`).run(existing.order_id);
            await db.prepare(`UPDATE lab_orders SET status = 'processing' WHERE id = ? AND status = 'pending'`).run(existing.order_id);
        }
        const updated = await db.prepare(`SELECT * FROM lab_home_collections WHERE id = ?`).get(id);
        return ok({ collection: updated });
    }
    catch (err) {
        return handleApiError(err);
    }
}
