import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
async function getSale(db: any, id: number) {
    const sale = await db.prepare(`SELECT ps.*, u.name AS sold_by_name
     FROM pharmacy_sales ps JOIN users u ON u.id = ps.sold_by_user_id
     WHERE ps.id = ?`).get(id);
    if (!sale)
        return null;
    const items = await db.prepare(`SELECT psi.*, m.stock_qty AS current_stock
     FROM pharmacy_sale_items psi
     LEFT JOIN medicines m ON m.id = psi.medicine_id
     WHERE psi.sale_id = ? ORDER BY psi.id`).all(id);
    return { ...sale, items };
}
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const sale = await getSale(db, Number(params.id));
        if (!sale)
            return fail('Sale not found.', 404);
        return ok({ sale });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function PUT(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const b = await req.json();
        const existing = await db.prepare(`SELECT * FROM pharmacy_sales WHERE id = ?`).get(id) as any;
        if (!existing)
            return fail('Sale not found.', 404);
        const updates: string[] = [];
        const vals: any[] = [];
        if (b.payment_method) {
            updates.push('payment_method = ?');
            vals.push(b.payment_method);
        }
        if (b.notes !== undefined) {
            updates.push('notes = ?');
            vals.push(b.notes);
        }
        if (b.paid_amount !== undefined) {
            const paid = Number(b.paid_amount);
            const status = paid >= existing.total && existing.total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
            updates.push('paid_amount = ?', 'payment_status = ?');
            vals.push(paid, status);
        }
        if (b.discount !== undefined) {
            const discount = Number(b.discount);
            const total = Math.max(existing.subtotal - discount, 0);
            const paid = b.paid_amount !== undefined ? Number(b.paid_amount) : existing.paid_amount;
            const status = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
            updates.push('discount = ?', 'total = ?', 'payment_status = ?');
            vals.push(discount, total, status);
        }
        if (!updates.length)
            return fail('Nothing to update.');
        await db.prepare(`UPDATE pharmacy_sales SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        return ok({ sale: await getSale(db, id) });
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
        await requireRole('super_admin');
        const db = await getDb();
        const id = Number(params.id);
        // Restore stock on deletion
        const items = await db.prepare(`SELECT * FROM pharmacy_sale_items WHERE sale_id = ?`).all(id) as any[];
        const tx = db.transaction(async () => {
            for (const item of items) {
                await db.prepare(`UPDATE medicines SET stock_qty = stock_qty + ? WHERE id = ?`).run(item.qty, item.medicine_id);
                if (item.batch_id)
                    await db.prepare(`UPDATE medicine_batches SET qty = qty + ? WHERE id = ?`).run(item.qty, item.batch_id);
                await db.prepare(`DELETE FROM stock_movements WHERE reference_no = ? AND movement_type = 'sale' AND medicine_id = ?`).run(item.reference_no || '', item.medicine_id);
            }
            await db.prepare(`DELETE FROM stock_movements WHERE reference_no = (SELECT sale_no FROM pharmacy_sales WHERE id = ?)`).run(id);
            await db.prepare(`DELETE FROM pharmacy_sales WHERE id = ?`).run(id);
        });
        await tx();
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
