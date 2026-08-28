import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const q = req.nextUrl.searchParams.get('q')?.trim();
        const all = req.nextUrl.searchParams.get('all') === '1';
        const location = req.nextUrl.searchParams.get('location'); // 'pharmacy' | 'store' | null
        const from = req.nextUrl.searchParams.get('from');
        const to = req.nextUrl.searchParams.get('to');
        let sql = `SELECT * FROM medicines`;
        const vals: any[] = [];
        const conds: string[] = [];
        if (!all)
            conds.push('active = 1');
        if (q) {
            conds.push('(name LIKE ? OR generic_name LIKE ? OR category LIKE ?)');
            vals.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        if (location) {
            conds.push('location = ?');
            vals.push(location);
        }
        if (from) {
            conds.push('LEFT(created_at, 10) >= ?');
            vals.push(from);
        }
        if (to) {
            conds.push('LEFT(created_at, 10) <= ?');
            vals.push(to);
        }
        if (conds.length)
            sql += ` WHERE ${conds.join(' AND ')}`;
        sql += ' ORDER BY name ASC';
        const medicines = await db.prepare(sql).all(...vals);
        return ok({ medicines });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        const session = await requireRole('super_admin', 'pharmacy_admin');
        const b = await req.json();
        const name = String(b.name || '').trim();
        if (!name)
            return fail('Medicine name is required.');
        const db = await getDb();
        const stock_qty = Number(b.stock_qty || 0);
        const stock_qty_store = Number(b.stock_qty_store || 0);
        const result = await db.prepare(`INSERT INTO medicines (name, generic_name, category, unit, purchase_price, sale_price,
        stock_qty, stock_qty_store, low_stock_at, manufacturer, location, prescription_required)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, b.generic_name || null, b.category || null, b.unit || 'tablet', Number(b.purchase_price || 0), Number(b.sale_price || 0), stock_qty, stock_qty_store, Number(b.low_stock_at || 10), b.manufacturer || null, b.location || 'pharmacy', b.prescription_required ? 1 : 0);
        const medId = result.lastInsertRowid as number;
        // Log opening stock movement for pharmacy
        if (stock_qty > 0) {
            await db.prepare(`INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, notes, created_by_user_id)
         VALUES (?, ?, 'opening', 'pharmacy', ?, 0, ?, 'Opening stock on medicine creation', ?)`).run(medId, name, stock_qty, stock_qty, session.id);
        }
        // Log opening stock for store
        if (stock_qty_store > 0) {
            await db.prepare(`INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, notes, created_by_user_id)
         VALUES (?, ?, 'opening', 'store', ?, 0, ?, 'Opening store stock on medicine creation', ?)`).run(medId, name, stock_qty_store, stock_qty_store, session.id);
        }
        return ok({ id: medId }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
