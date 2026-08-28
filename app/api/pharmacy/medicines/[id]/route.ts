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
        const session = await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const b = await req.json();
        const id = Number(params.id);
        const med = await db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(id) as any;
        if (!med)
            return fail('Medicine not found.', 404);
        const fields: Record<string, any> = {
            name: b.name, generic_name: b.generic_name, category: b.category,
            unit: b.unit, purchase_price: b.purchase_price, sale_price: b.sale_price,
            low_stock_at: b.low_stock_at, manufacturer: b.manufacturer, location: b.location
        };
        if (typeof b.active === 'boolean')
            fields.active = b.active ? 1 : 0;
        if (typeof b.prescription_required === 'boolean')
            fields.prescription_required = b.prescription_required ? 1 : 0;
        // Handle stock_qty change — log a movement if quantity changed
        if (b.stock_qty !== undefined) {
            const newQty = Number(b.stock_qty);
            const diff = newQty - med.stock_qty;
            if (diff !== 0) {
                const mtype = diff > 0 ? (b.movement_type || 'adjustment') : 'adjustment';
                await db.prepare(`INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, reference_no, notes, created_by_user_id)
           VALUES (?, ?, ?, 'pharmacy', ?, ?, ?, ?, ?, ?)`).run(id, med.name, mtype, diff, med.stock_qty, newQty, b.reference_no || null, b.notes || null, session.id);
            }
            fields.stock_qty = newQty;
        }
        // Handle stock_qty_store change
        if (b.stock_qty_store !== undefined) {
            const newQty = Number(b.stock_qty_store);
            const diff = newQty - med.stock_qty_store;
            if (diff !== 0) {
                const mtype = diff > 0 ? (b.movement_type || 'adjustment') : 'adjustment';
                await db.prepare(`INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, reference_no, notes, created_by_user_id)
           VALUES (?, ?, ?, 'store', ?, ?, ?, ?, ?, ?)`).run(id, med.name, mtype, diff, med.stock_qty_store, newQty, b.reference_no || null, b.notes || null, session.id);
            }
            fields.stock_qty_store = newQty;
        }
        const updates = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
        const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
        if (!updates.length)
            return fail('Nothing to update.');
        await db.prepare(`UPDATE medicines SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        return ok({ updated: true, medicine: await db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(id) });
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
        const used = await db.prepare(`SELECT COUNT(*) AS c FROM pharmacy_sale_items WHERE medicine_id = ?`).get(id) as {
            c: number;
        };
        if (used.c > 0) {
            await db.prepare(`UPDATE medicines SET active = 0 WHERE id = ?`).run(id);
            return ok({ deactivated: true });
        }
        await db.prepare(`DELETE FROM stock_movements WHERE medicine_id = ?`).run(id);
        await db.prepare(`DELETE FROM medicines WHERE id = ?`).run(id);
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
