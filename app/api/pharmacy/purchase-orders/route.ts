import { NextRequest } from 'next/server';
import { getDb, nextPoNo } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

const PO_SELECT = `
  SELECT po.*, s.name AS supplier_name, u.name AS created_by_name
  FROM purchase_orders po
  JOIN suppliers s ON s.id = po.supplier_id
  JOIN users u ON u.id = po.created_by_user_id
`;

export async function GET(req: NextRequest) {
  try {
    await requireRole('super_admin', 'pharmacy_admin');
    const db = getDb();
    const sp = req.nextUrl.searchParams;
    const conds: string[] = [];
    const vals: any[] = [];
    const supplierId = sp.get('supplier_id');
    const status = sp.get('status');
    const from = sp.get('from');
    const to = sp.get('to');
    if (supplierId) { conds.push('po.supplier_id = ?'); vals.push(Number(supplierId)); }
    if (status) { conds.push('po.status = ?'); vals.push(status); }
    if (from) { conds.push('date(po.created_at) >= ?'); vals.push(from); }
    if (to) { conds.push('date(po.created_at) <= ?'); vals.push(to); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const orders = db.prepare(`${PO_SELECT} ${where} ORDER BY po.created_at DESC LIMIT 500`).all(...vals);
    return ok({ purchaseOrders: orders });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole('super_admin', 'pharmacy_admin');
    const b = await req.json();
    if (!b.supplier_id) return fail('Supplier is required.');
    if (!Array.isArray(b.items) || b.items.length === 0) return fail('Add at least one medicine to the order.');

    const db = getDb();
    const supplier = db.prepare(`SELECT * FROM suppliers WHERE id = ? AND active = 1`).get(Number(b.supplier_id)) as any;
    if (!supplier) return fail('Supplier not found or inactive.');

    for (const item of b.items) {
      const med = db.prepare(`SELECT * FROM medicines WHERE id = ? AND active = 1`).get(Number(item.medicine_id)) as any;
      if (!med) return fail(`Medicine ID ${item.medicine_id} not found or inactive.`);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const po_no = nextPoNo(db, dateStr);
    const subtotal = b.items.reduce((s: number, i: any) => s + Number(i.ordered_qty) * Number(i.unit_price), 0);
    const discount = Number(b.discount || 0);
    const total = Math.max(subtotal - discount, 0);

    const status = b.status === 'ordered' ? 'ordered' : 'draft';

    const tx = db.transaction(() => {
      const result = db.prepare(
        `INSERT INTO purchase_orders (po_no, supplier_id, status, expected_date, subtotal, discount, total, notes, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(po_no, supplier.id, status, b.expected_date || null, subtotal, discount, total, b.notes || null, session.id);
      const poId = result.lastInsertRowid as number;

      for (const item of b.items) {
        const med = db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(Number(item.medicine_id)) as any;
        const lineTotal = Number(item.ordered_qty) * Number(item.unit_price);
        db.prepare(
          `INSERT INTO purchase_order_items (po_id, medicine_id, medicine_name, ordered_qty, unit_price, total)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(poId, med.id, med.name, Number(item.ordered_qty), Number(item.unit_price), lineTotal);
      }
      return poId;
    });

    const poId = tx();
    return ok({ id: poId, po_no }, 201);
  } catch (err) { return handleApiError(err); }
}
