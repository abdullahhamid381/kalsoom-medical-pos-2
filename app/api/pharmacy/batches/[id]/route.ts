import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function PUT(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const b = await req.json();
        const id = Number(params.id);
        const batch = await db.prepare(`SELECT * FROM medicine_batches WHERE id = ?`).get(id) as any;
        if (!batch)
            return fail('Batch not found.', 404);
        const fields: Record<string, any> = {
            batch_no: b.batch_no, expiry_date: b.expiry_date, mfg_date: b.mfg_date,
            purchase_price: b.purchase_price, sale_price: b.sale_price, notes: b.notes,
        };
        const updates = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
        const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
        if (!updates.length)
            return fail('Nothing to update.');
        await db.prepare(`UPDATE medicine_batches SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        return ok({ updated: true, batch: await db.prepare(`SELECT * FROM medicine_batches WHERE id = ?`).get(id) });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function DELETE(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const id = Number(params.id);
        const batch = await db.prepare(`SELECT * FROM medicine_batches WHERE id = ?`).get(id) as any;
        if (!batch)
            return fail('Batch not found.', 404);
        const usedInSale = await db.prepare(`SELECT COUNT(*) AS c FROM pharmacy_sale_items WHERE batch_id = ?`).get(id) as {
            c: number;
        };
        const usedInMovement = await db.prepare(`SELECT COUNT(*) AS c FROM stock_movements WHERE batch_id = ?`).get(id) as {
            c: number;
        };
        if (usedInSale.c > 0 || usedInMovement.c > 1) {
            await db.prepare(`UPDATE medicine_batches SET active = 0 WHERE id = ?`).run(id);
            return ok({ deactivated: true });
        }
        const tx = db.transaction(async () => {
            // Reverse the opening movement this batch created, then remove both.
            const med = await db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(batch.medicine_id) as any;
            const field = batch.location === 'store' ? 'stock_qty_store' : 'stock_qty';
            const current = batch.location === 'store' ? med.stock_qty_store : med.stock_qty;
            await db.prepare(`UPDATE medicines SET ${field} = ? WHERE id = ?`).run(Math.max(current - batch.qty, 0), batch.medicine_id);
            await db.prepare(`DELETE FROM stock_movements WHERE batch_id = ?`).run(id);
            await db.prepare(`DELETE FROM medicine_batches WHERE id = ?`).run(id);
        });
        await tx();
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
