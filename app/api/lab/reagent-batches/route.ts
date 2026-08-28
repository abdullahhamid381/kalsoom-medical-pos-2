import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
    try {
        const session = await requireRole('super_admin');
        const b = await req.json();
        const db = await getDb();
        const reagent_id = Number(b.reagent_id);
        const reagent = await db.prepare(`SELECT * FROM lab_reagents WHERE id = ?`).get(reagent_id) as any;
        if (!reagent)
            return fail('Reagent not found.');
        const qty = Number(b.qty);
        if (!qty || qty <= 0)
            return fail('Quantity must be greater than zero.');
        const batch_no = String(b.batch_no || '').trim();
        const expiry_date = String(b.expiry_date || '').trim();
        if (!batch_no || !expiry_date)
            return fail('Batch number and expiry date are required.');
        const qtyBefore = reagent.stock_qty;
        const qtyAfter = qtyBefore + qty;
        const tx = db.transaction(async () => {
            const batchResult = await db.prepare(`INSERT INTO lab_reagent_batches (reagent_id, batch_no, expiry_date, qty, created_by_user_id) VALUES (?, ?, ?, ?, ?)`).run(reagent_id, batch_no, expiry_date, qty, session.id);
            await db.prepare(`UPDATE lab_reagents SET stock_qty = ? WHERE id = ?`).run(qtyAfter, reagent_id);
            await db.prepare(`INSERT INTO lab_reagent_movements (reagent_id, movement_type, qty_change, qty_before, qty_after, batch_id, created_by_user_id)
         VALUES (?, 'opening', ?, ?, ?, ?, ?)`).run(reagent_id, qty, qtyBefore, qtyAfter, batchResult.lastInsertRowid, session.id);
        });
        await tx();
        return ok({ reagent: await db.prepare(`SELECT * FROM lab_reagents WHERE id = ?`).get(reagent_id) }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
