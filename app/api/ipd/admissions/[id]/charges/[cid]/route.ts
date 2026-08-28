import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { recalcTotals } from '@/lib/ipdCharges';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function PUT(req: NextRequest, { params }: {
    params: {
        id: string;
        cid: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const cid = Number(params.cid);
        const b = await req.json();
        const charge = await db.prepare(`SELECT * FROM admission_charges WHERE id = ?`).get(cid) as any;
        if (!charge)
            return fail('Charge not found.', 404);
        const qty = b.quantity !== undefined ? Number(b.quantity) : charge.quantity;
        const unit_price = b.unit_price !== undefined ? Number(b.unit_price) : charge.unit_price;
        const total = qty * unit_price;
        await db.prepare(`
      UPDATE admission_charges SET
        description = ?, quantity = ?, unit_price = ?, total = ?, charge_date = ?
      WHERE id = ?
    `).run(b.description || charge.description, qty, unit_price, total, b.charge_date || charge.charge_date, cid);
        await recalcTotals(db, Number(params.id));
        return ok({ updated: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function DELETE(_req: NextRequest, { params }: {
    params: {
        id: string;
        cid: string;
    };
}) {
    try {
        await requireRole('super_admin', 'ward_admin');
        const db = await getDb();
        const cid = Number(params.cid);
        const charge = await db.prepare(`SELECT * FROM admission_charges WHERE id = ?`).get(cid) as any;
        if (!charge)
            return fail('Charge not found.', 404);
        if (charge.charge_type === 'room' && charge.ref_sale_id === null && charge.ref_order_id === null) {
            // Allow deleting manual room charges
        }
        await db.prepare(`DELETE FROM admission_charges WHERE id = ?`).run(cid);
        await recalcTotals(db, Number(params.id));
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
