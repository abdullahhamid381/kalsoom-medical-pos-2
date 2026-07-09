import { NextRequest } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const db = getDb();
    const sp = req.nextUrl.searchParams;
    const from = sp.get('from') || new Date().toISOString().slice(0, 10);
    const to   = sp.get('to')   || new Date().toISOString().slice(0, 10);

    const totals = db.prepare(`
      SELECT COUNT(*) AS total_sales,
             COALESCE(SUM(total), 0) AS total_billed,
             COALESCE(SUM(paid_amount), 0) AS total_collected
      FROM pharmacy_sales
      WHERE date(created_at) BETWEEN ? AND ?
    `).get(from, to);

    const byPaymentMethod = db.prepare(`
      SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(paid_amount), 0) AS collected
      FROM pharmacy_sales WHERE date(created_at) BETWEEN ? AND ?
      GROUP BY payment_method
    `).all(from, to);

    const byDay = db.prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS count,
             COALESCE(SUM(paid_amount), 0) AS collected
      FROM pharmacy_sales WHERE date(created_at) BETWEEN ? AND ?
      GROUP BY date(created_at) ORDER BY date ASC
    `).all(from, to);

    const topMedicines = db.prepare(`
      SELECT psi.medicine_name, SUM(psi.qty) AS total_qty, SUM(psi.total) AS total_revenue
      FROM pharmacy_sale_items psi
      JOIN pharmacy_sales ps ON ps.id = psi.sale_id
      WHERE date(ps.created_at) BETWEEN ? AND ?
      GROUP BY psi.medicine_name ORDER BY total_revenue DESC LIMIT 10
    `).all(from, to);

    const lowStock = db.prepare(`
      SELECT * FROM medicines WHERE active = 1 AND stock_qty <= low_stock_at ORDER BY stock_qty ASC
    `).all();

    const expiryAlertDays = Number(getSetting('expiry_alert_days', '60')) || 60;
    const expiredBatches = db.prepare(`
      SELECT mb.*, m.name AS medicine_name, m.unit FROM medicine_batches mb
      JOIN medicines m ON m.id = mb.medicine_id
      WHERE mb.active = 1 AND mb.qty > 0 AND mb.expiry_date < date('now')
      ORDER BY mb.expiry_date ASC
    `).all();
    const nearExpiryBatches = db.prepare(`
      SELECT mb.*, m.name AS medicine_name, m.unit FROM medicine_batches mb
      JOIN medicines m ON m.id = mb.medicine_id
      WHERE mb.active = 1 AND mb.qty > 0 AND mb.expiry_date >= date('now') AND mb.expiry_date <= date('now', '+' || ? || ' days')
      ORDER BY mb.expiry_date ASC
    `).all(expiryAlertDays);

    return ok({ from, to, totals, byPaymentMethod, byDay, topMedicines, lowStock, expiredBatches, nearExpiryBatches });
  } catch (err) { return handleApiError(err); }
}
