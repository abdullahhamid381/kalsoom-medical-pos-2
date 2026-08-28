import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const conds: string[] = ['mb.active = 1'];
        const vals: any[] = [];
        const batchId = sp.get('id');
        const medicineId = sp.get('medicine_id');
        const supplierId = sp.get('supplier_id');
        const location = sp.get('location');
        const status = sp.get('status'); // 'expired' | 'near_expiry'
        const q = sp.get('q')?.trim();
        const days = Number(sp.get('days') || 60);
        const minQty = sp.get('min_qty');
        const from = sp.get('from');
        const to = sp.get('to');
        if (batchId) {
            conds.push('mb.id = ?');
            vals.push(Number(batchId));
        }
        if (medicineId) {
            conds.push('mb.medicine_id = ?');
            vals.push(Number(medicineId));
        }
        if (supplierId) {
            conds.push('mb.supplier_id = ?');
            vals.push(Number(supplierId));
        }
        if (location) {
            conds.push('mb.location = ?');
            vals.push(location);
        }
        if (q) {
            conds.push('(m.name LIKE ? OR mb.batch_no LIKE ?)');
            vals.push(`%${q}%`, `%${q}%`);
        }
        if (status === 'expired')
            conds.push(`mb.expiry_date < today_iso()`);
        if (status === 'near_expiry')
            conds.push(`mb.expiry_date >= today_iso() AND mb.expiry_date <= today_plus_iso(${days})`);
        if (minQty) {
            conds.push('mb.qty >= ?');
            vals.push(Number(minQty));
        }
        if (from) {
            conds.push('mb.expiry_date >= ?');
            vals.push(from);
        }
        if (to) {
            conds.push('mb.expiry_date <= ?');
            vals.push(to);
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const batches = await db.prepare(`SELECT mb.*, m.name AS medicine_name, m.unit
       FROM medicine_batches mb
       JOIN medicines m ON m.id = mb.medicine_id
       ${where}
       ORDER BY mb.expiry_date ASC`).all(...vals);
        return ok({ batches });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        const session = await requireRole('super_admin', 'pharmacy_admin');
        const b = await req.json();
        const db = await getDb();
        const medicine_id = Number(b.medicine_id);
        const med = await db.prepare(`SELECT * FROM medicines WHERE id = ? AND active = 1`).get(medicine_id) as any;
        if (!med)
            return fail('Medicine not found or inactive.');
        const batch_no = String(b.batch_no || '').trim();
        if (!batch_no)
            return fail('Batch number is required.');
        const expiry_date = String(b.expiry_date || '').trim();
        if (!expiry_date)
            return fail('Expiry date is required.');
        const qty = Number(b.qty || 0);
        if (qty <= 0)
            return fail('Batch quantity must be greater than zero.');
        const location = b.location === 'pharmacy' ? 'pharmacy' : 'store';
        const tx = db.transaction(async () => {
            const result = await db.prepare(`INSERT INTO medicine_batches
           (medicine_id, batch_no, expiry_date, mfg_date, qty, purchase_price, sale_price, location, notes, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(medicine_id, batch_no, expiry_date, b.mfg_date || null, qty, Number(b.purchase_price || 0), Number(b.sale_price || 0), location, b.notes || null, session.id);
            const batchId = result.lastInsertRowid as number;
            const field = location === 'store' ? 'stock_qty_store' : 'stock_qty';
            const qty_before = location === 'store' ? med.stock_qty_store : med.stock_qty;
            const qty_after = qty_before + qty;
            await db.prepare(`UPDATE medicines SET ${field} = ? WHERE id = ?`).run(qty_after, medicine_id);
            await db.prepare(`INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, notes, batch_id, created_by_user_id)
         VALUES (?, ?, 'opening', ?, ?, ?, ?, ?, ?, ?)`).run(medicine_id, med.name, location, qty, qty_before, qty_after, `Opening batch ${batch_no}`, batchId, session.id);
            return batchId;
        });
        const batchId = await tx();
        return ok({ id: batchId }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
