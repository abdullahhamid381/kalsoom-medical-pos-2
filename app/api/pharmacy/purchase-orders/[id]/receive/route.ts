import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function POST(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const poId = Number(params.id);
        const po = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(poId) as any;
        if (!po)
            return fail('Purchase order not found.', 404);
        if (po.status === 'received' || po.status === 'cancelled')
            return fail(`Purchase order is already ${po.status}.`);
        const b = await req.json();
        if (!Array.isArray(b.items) || b.items.length === 0)
            return fail('Specify at least one line to receive.');
        // Validate every line against remaining ordered qty
        for (const line of b.items) {
            const qty = Number(line.qty || 0);
            if (qty <= 0)
                continue;
            const poItem = await db.prepare(`SELECT * FROM purchase_order_items WHERE id = ? AND po_id = ?`).get(Number(line.po_item_id), poId) as any;
            if (!poItem)
                return fail(`Purchase order line ${line.po_item_id} not found.`);
            const remaining = poItem.ordered_qty - poItem.received_qty;
            if (qty > remaining)
                return fail(`Cannot receive ${qty} of ${poItem.medicine_name} — only ${remaining} remaining on this order.`);
            if (!String(line.batch_no || '').trim())
                return fail(`Batch number is required for ${poItem.medicine_name}.`);
            if (!String(line.expiry_date || '').trim())
                return fail(`Expiry date is required for ${poItem.medicine_name}.`);
        }
        const tx = db.transaction(async () => {
            for (const line of b.items) {
                const qty = Number(line.qty || 0);
                if (qty <= 0)
                    continue;
                const poItem = await db.prepare(`SELECT * FROM purchase_order_items WHERE id = ?`).get(Number(line.po_item_id)) as any;
                const med = await db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(poItem.medicine_id) as any;
                const location = line.location === 'pharmacy' ? 'pharmacy' : 'store';
                const batchResult = await db.prepare(`INSERT INTO medicine_batches
             (medicine_id, batch_no, expiry_date, mfg_date, qty, purchase_price, sale_price, location, supplier_id, purchase_order_id, reference_no, created_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(med.id, String(line.batch_no).trim(), line.expiry_date, line.mfg_date || null, qty, poItem.unit_price, Number(line.sale_price || med.sale_price || 0), location, po.supplier_id, poId, po.po_no, session.id);
                const batchId = batchResult.lastInsertRowid as number;
                await db.prepare(`UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE id = ?`).run(qty, poItem.id);
                const field = location === 'store' ? 'stock_qty_store' : 'stock_qty';
                const qty_before = location === 'store' ? med.stock_qty_store : med.stock_qty;
                const qty_after = qty_before + qty;
                await db.prepare(`UPDATE medicines SET ${field} = ? WHERE id = ?`).run(qty_after, med.id);
                await db.prepare(`INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, reference_no, notes, batch_id, created_by_user_id)
           VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?, ?, ?, ?)`).run(med.id, med.name, location, qty, qty_before, qty_after, po.po_no, `Received against ${po.po_no}`, batchId, session.id);
            }
            const items = await db.prepare(`SELECT * FROM purchase_order_items WHERE po_id = ?`).all(poId) as any[];
            const fullyReceived = items.every(i => i.received_qty >= i.ordered_qty);
            const anyReceived = items.some(i => i.received_qty > 0);
            const newStatus = fullyReceived ? 'received' : anyReceived ? 'partially_received' : po.status;
            await db.prepare(`UPDATE purchase_orders SET status = ?, updated_at = now_iso() WHERE id = ?`).run(newStatus, poId);
        });
        await tx();
        const updated = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(poId);
        return ok({ purchaseOrder: updated });
    }
    catch (err) {
        return handleApiError(err);
    }
}
