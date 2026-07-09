import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin', 'pharmacy_admin');
    const db = getDb();
    const id = Number(params.id);
    const supplier = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id) as any;
    if (!supplier) return fail('Supplier not found.', 404);

    const purchaseOrders = db.prepare(
      `SELECT * FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC`
    ).all(id);
    const payments = db.prepare(
      `SELECT sp.*, u.name AS paid_by_name FROM supplier_payments sp
       JOIN users u ON u.id = sp.paid_by_user_id
       WHERE sp.supplier_id = ? ORDER BY sp.created_at DESC`
    ).all(id);
    const purchaseReturns = db.prepare(
      `SELECT * FROM purchase_returns WHERE supplier_id = ? ORDER BY created_at DESC`
    ).all(id);

    const receivedValue = db.prepare(
      `SELECT COALESCE(SUM(poi.received_qty * poi.unit_price), 0) AS total
       FROM purchase_order_items poi
       JOIN purchase_orders po ON po.id = poi.po_id
       WHERE po.supplier_id = ?`
    ).get(id) as { total: number };
    const totalPaid = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM supplier_payments WHERE supplier_id = ?`
    ).get(id) as { total: number };
    const totalReturned = db.prepare(
      `SELECT COALESCE(SUM(total), 0) AS total FROM purchase_returns WHERE supplier_id = ?`
    ).get(id) as { total: number };

    const balance = receivedValue.total - totalPaid.total - totalReturned.total;

    return ok({
      supplier, purchaseOrders, payments, purchaseReturns,
      receivedValue: receivedValue.total, totalPaid: totalPaid.total, totalReturned: totalReturned.total,
      balance,
    });
  } catch (err) { return handleApiError(err); }
}
