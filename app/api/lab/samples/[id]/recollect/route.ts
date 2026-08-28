import { NextRequest } from 'next/server';
import { getDb, nextSampleId } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function POST(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'lab_technician');
        const db = await getDb();
        const id = Number(params.id);
        const sample = await db.prepare(`SELECT * FROM lab_samples WHERE id = ?`).get(id) as any;
        if (!sample)
            return fail('Sample not found.', 404);
        if (sample.status !== 'rejected' || !sample.recollect_required) {
            return fail('Only a rejected sample marked for recollection can be re-drawn.');
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        const tx = db.transaction(async () => {
            const newId = await nextSampleId(db, dateStr);
            const r = await db.prepare(`INSERT INTO lab_samples (sample_id, order_id, sample_type, replaces_sample_id) VALUES (?, ?, ?, ?)`).run(newId, sample.order_id, sample.sample_type, id);
            const newRowId = r.lastInsertRowid as number;
            await db.prepare(`UPDATE lab_order_items SET sample_id = ? WHERE sample_id = ?`).run(newRowId, id);
            await db.prepare(`UPDATE lab_samples SET recollect_required = 0 WHERE id = ?`).run(id);
            return newRowId;
        });
        const newRowId = await tx();
        const newSample = await db.prepare(`SELECT * FROM lab_samples WHERE id = ?`).get(newRowId);
        return ok({ sample: newSample }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
