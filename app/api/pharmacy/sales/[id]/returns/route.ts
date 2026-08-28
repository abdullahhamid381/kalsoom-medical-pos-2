import { NextRequest } from 'next/server';
import { getDb, nextSaleReturnNo } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const saleId = Number(params.id);
        const returns = await db.prepare(`SELECT psr.*, u.name AS created_by_name FROM pharmacy_sale_returns psr
       JOIN users u ON u.id = psr.created_by_user_id
       WHERE psr.sale_id = ? ORDER BY psr.created_at DESC`).all(saleId);
        return ok({ returns });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const saleId = Number(params.id);
        const sale = await db.prepare(`SELECT * FROM pharmacy_sales WHERE id = ?`).get(saleId) as any;
        if (!sale)
            return fail('Sale not found.', 404);
        const b = await req.json();
        if (!Array.isArray(b.items) || b.items.length === 0)
            return fail('Select at least one item to return.');
        const outcome = ['refund', 'store_credit', 'exchange'].includes(b.outcome) ? b.outcome : 'refund';
        for (const line of b.items) {
            const saleItem = await db.prepare(`SELECT * FROM pharmacy_sale_items WHERE id = ? AND sale_id = ?`).get(Number(line.sale_item_id), saleId) as any;
            if (!saleItem)
                return fail(`Sale line ${line.sale_item_id} not found.`);
            const returnable = saleItem.qty - saleItem.returned_qty;
            if (Number(line.qty) > returnable)
                return fail(`Cannot return ${line.qty} of ${saleItem.medicine_name} — only ${returnable} returnable.`);
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        const return_no = await nextSaleReturnNo(db, dateStr);
        let total = 0;
        for (const line of b.items) {
            const saleItem = await db.prepare(`SELECT * FROM pharmacy_sale_items WHERE id = ?`).get(Number(line.sale_item_id)) as any;
            total += Number(line.qty) * saleItem.unit_price;
        }
        const tx = db.transaction(async () => {
            const result = await db.prepare(`INSERT INTO pharmacy_sale_returns (return_no, sale_id, outcome, refund_amount, credit_amount, total, reason, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(return_no, saleId, outcome, outcome === 'refund' ? total : 0, outcome === 'store_credit' || outcome === 'exchange' ? total : 0, total, b.reason || null, session.id);
            const returnId = result.lastInsertRowid as number;
            for (const line of b.items) {
                const saleItem = await db.prepare(`SELECT * FROM pharmacy_sale_items WHERE id = ?`).get(Number(line.sale_item_id)) as any;
                const med = await db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(saleItem.medicine_id) as any;
                const qty = Number(line.qty);
                const lineTotal = qty * saleItem.unit_price;
                await db.prepare(`INSERT INTO pharmacy_sale_return_items (return_id, sale_item_id, medicine_id, medicine_name, batch_id, qty, unit_price, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(returnId, saleItem.id, med.id, med.name, saleItem.batch_id || null, qty, saleItem.unit_price, lineTotal);
                await db.prepare(`UPDATE pharmacy_sale_items SET returned_qty = returned_qty + ? WHERE id = ?`).run(qty, saleItem.id);
                // Restock: pharmacy-counter aggregate always, plus the specific batch if one was recorded on the sale.
                const qty_before = med.stock_qty;
                const qty_after = qty_before + qty;
                await db.prepare(`UPDATE medicines SET stock_qty = stock_qty + ? WHERE id = ?`).run(qty, med.id);
                if (saleItem.batch_id) {
                    await db.prepare(`UPDATE medicine_batches SET qty = qty + ? WHERE id = ?`).run(qty, saleItem.batch_id);
                }
                await db.prepare(`INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, reference_no, notes, batch_id, created_by_user_id)
           VALUES (?, ?, 'sale_return', 'pharmacy', ?, ?, ?, ?, ?, ?, ?)`).run(med.id, med.name, qty, qty_before, qty_after, return_no, `Returned from sale ${sale.sale_no}`, saleItem.batch_id || null, session.id);
            }
            if (outcome === 'store_credit' || outcome === 'exchange') {
                if (sale.patient_phone) {
                    await db.prepare(`INSERT INTO customer_credits (phone, customer_name, amount, source, sale_return_id, created_by_user_id)
             VALUES (?, ?, ?, 'return', ?, ?)`).run(sale.patient_phone, sale.patient_name, total, returnId, session.id);
                }
            }
            return returnId;
        });
        const returnId = await tx();
        return ok({ id: returnId, return_no }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
