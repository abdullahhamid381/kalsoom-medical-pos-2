import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const from = sp.get('from') || new Date().toISOString().slice(0, 10);
        const to = sp.get('to') || new Date().toISOString().slice(0, 10);
        const suppliers = await db.prepare(`SELECT * FROM suppliers WHERE active = 1 ORDER BY name ASC`).all() as any[];
        // Range-scoped activity, grouped per supplier
        const receivedInRange = await db.prepare(`
      SELECT po.supplier_id, COALESCE(SUM(poi.received_qty * poi.unit_price), 0) AS total
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.po_id
      WHERE LEFT(po.created_at, 10) BETWEEN ? AND ?
      GROUP BY po.supplier_id
    `).all(from, to) as {
            supplier_id: number;
            total: number;
        }[];
        const paidInRange = await db.prepare(`
      SELECT supplier_id, COALESCE(SUM(amount), 0) AS total FROM supplier_payments
      WHERE LEFT(created_at, 10) BETWEEN ? AND ? GROUP BY supplier_id
    `).all(from, to) as {
            supplier_id: number;
            total: number;
        }[];
        const returnedInRange = await db.prepare(`
      SELECT supplier_id, COALESCE(SUM(total), 0) AS total FROM purchase_returns
      WHERE LEFT(created_at, 10) BETWEEN ? AND ? GROUP BY supplier_id
    `).all(from, to) as {
            supplier_id: number;
            total: number;
        }[];
        // All-time, for the running balance (a balance owed isn't scoped to a date range)
        const receivedAllTime = await db.prepare(`
      SELECT po.supplier_id, COALESCE(SUM(poi.received_qty * poi.unit_price), 0) AS total
      FROM purchase_order_items poi JOIN purchase_orders po ON po.id = poi.po_id
      GROUP BY po.supplier_id
    `).all() as {
            supplier_id: number;
            total: number;
        }[];
        const paidAllTime = await db.prepare(`SELECT supplier_id, COALESCE(SUM(amount), 0) AS total FROM supplier_payments GROUP BY supplier_id`).all() as {
            supplier_id: number;
            total: number;
        }[];
        const returnedAllTime = await db.prepare(`SELECT supplier_id, COALESCE(SUM(total), 0) AS total FROM purchase_returns GROUP BY supplier_id`).all() as {
            supplier_id: number;
            total: number;
        }[];
        const toMap = (rows: {
            supplier_id: number;
            total: number;
        }[]) => new Map(rows.map(r => [r.supplier_id, r.total]));
        const receivedRangeMap = toMap(receivedInRange);
        const paidRangeMap = toMap(paidInRange);
        const returnedRangeMap = toMap(returnedInRange);
        const receivedAllMap = toMap(receivedAllTime);
        const paidAllMap = toMap(paidAllTime);
        const returnedAllMap = toMap(returnedAllTime);
        const rows = suppliers.map(s => {
            const receivedRange = receivedRangeMap.get(s.id) || 0;
            const paidRange = paidRangeMap.get(s.id) || 0;
            const returnedRange = returnedRangeMap.get(s.id) || 0;
            const receivedAll = receivedAllMap.get(s.id) || 0;
            const paidAll = paidAllMap.get(s.id) || 0;
            const returnedAll = returnedAllMap.get(s.id) || 0;
            return {
                id: s.id, name: s.name, phone: s.phone,
                receivedInRange: receivedRange, paidInRange: paidRange, returnedInRange: returnedRange,
                balance: receivedAll - paidAll - returnedAll,
            };
        });
        const totals = rows.reduce((acc, r) => ({
            receivedValue: acc.receivedValue + r.receivedInRange,
            totalPaid: acc.totalPaid + r.paidInRange,
            totalReturned: acc.totalReturned + r.returnedInRange,
            totalOutstanding: acc.totalOutstanding + Math.max(r.balance, 0),
        }), { receivedValue: 0, totalPaid: 0, totalReturned: 0, totalOutstanding: 0 });
        return ok({ from, to, suppliers: rows, totals });
    }
    catch (err) {
        return handleApiError(err);
    }
}
