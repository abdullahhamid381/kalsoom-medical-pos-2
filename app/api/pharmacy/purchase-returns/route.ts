import { NextRequest } from 'next/server';
import { getDb, nextPurchaseReturnNo } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(req: NextRequest) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const conds: string[] = [];
        const vals: any[] = [];
        const supplierId = sp.get('supplier_id');
        const from = sp.get('from');
        const to = sp.get('to');
        if (supplierId) {
            conds.push('pr.supplier_id = ?');
            vals.push(Number(supplierId));
        }
        if (from) {
            conds.push('LEFT(pr.created_at, 10) >= ?');
            vals.push(from);
        }
        if (to) {
            conds.push('LEFT(pr.created_at, 10) <= ?');
            vals.push(to);
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const returns = await db.prepare(`SELECT pr.*, s.name AS supplier_name, u.name AS created_by_name
       FROM purchase_returns pr
       JOIN suppliers s ON s.id = pr.supplier_id
       JOIN users u ON u.id = pr.created_by_user_id
       ${where}
       ORDER BY pr.created_at DESC LIMIT 500`).all(...vals);
        return ok({ purchaseReturns: returns });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        const session = await requireRole('super_admin', 'pharmacy_admin');
        const b = await req.json();
        if (!b.supplier_id)
            return fail('Supplier is required.');
        if (!Array.isArray(b.items) || b.items.length === 0)
            return fail('Add at least one batch to return.');
        const db = await getDb();
        const supplier = await db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(Number(b.supplier_id)) as any;
        if (!supplier)
            return fail('Supplier not found.');
        for (const item of b.items) {
            const batch = await db.prepare(`SELECT * FROM medicine_batches WHERE id = ? AND active = 1`).get(Number(item.batch_id)) as any;
            if (!batch)
                return fail(`Batch ID ${item.batch_id} not found or inactive.`);
            if (batch.qty < Number(item.qty))
                return fail(`Cannot return ${item.qty} from batch ${batch.batch_no} — only ${batch.qty} available.`);
        }
        const dateStr = new Date().toISOString().slice(0, 10);
        const return_no = await nextPurchaseReturnNo(db, dateStr);
        const total = b.items.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price), 0);
        const tx = db.transaction(async () => {
            const result = await db.prepare(`INSERT INTO purchase_returns (return_no, supplier_id, po_id, reason, total, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?)`).run(return_no, supplier.id, b.po_id ? Number(b.po_id) : null, b.reason || null, total, session.id);
            const returnId = result.lastInsertRowid as number;
            for (const item of b.items) {
                const batch = await db.prepare(`SELECT * FROM medicine_batches WHERE id = ?`).get(Number(item.batch_id)) as any;
                const med = await db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(batch.medicine_id) as any;
                const qty = Number(item.qty);
                const lineTotal = qty * Number(item.unit_price);
                await db.prepare(`INSERT INTO purchase_return_items (return_id, batch_id, medicine_id, medicine_name, qty, unit_price, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`).run(returnId, batch.id, med.id, med.name, qty, Number(item.unit_price), lineTotal);
                await db.prepare(`UPDATE medicine_batches SET qty = qty - ? WHERE id = ?`).run(qty, batch.id);
                const field = batch.location === 'store' ? 'stock_qty_store' : 'stock_qty';
                const qty_before = batch.location === 'store' ? med.stock_qty_store : med.stock_qty;
                const qty_after = Math.max(qty_before - qty, 0);
                await db.prepare(`UPDATE medicines SET ${field} = ? WHERE id = ?`).run(qty_after, med.id);
                await db.prepare(`INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, reference_no, notes, batch_id, created_by_user_id)
           VALUES (?, ?, 'purchase_return', ?, ?, ?, ?, ?, ?, ?, ?)`).run(med.id, med.name, batch.location, -qty, qty_before, qty_after, return_no, `Returned to ${supplier.name}`, batch.id, session.id);
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
