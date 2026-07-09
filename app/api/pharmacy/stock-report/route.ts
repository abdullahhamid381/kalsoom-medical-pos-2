import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';

export async function GET(req: NextRequest) {
  try {
    await requireRole('super_admin', 'pharmacy_admin');
    const db = getDb();
    const sp = req.nextUrl.searchParams;
    const from = sp.get('from') || new Date().toISOString().slice(0, 10);
    const to   = sp.get('to')   || new Date().toISOString().slice(0, 10);

    const totals = db.prepare(`
      SELECT
        COUNT(*) AS total_movements,
        COALESCE(SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END), 0) AS total_added,
        COALESCE(SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END), 0) AS total_removed
      FROM stock_movements
      WHERE date(created_at) BETWEEN ? AND ?
    `).get(from, to);

    const byType = db.prepare(`
      SELECT movement_type, location, COUNT(*) AS count,
             COALESCE(SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END), 0) AS added,
             COALESCE(SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END), 0) AS removed
      FROM stock_movements
      WHERE date(created_at) BETWEEN ? AND ?
      GROUP BY movement_type, location ORDER BY count DESC
    `).all(from, to);

    const byUser = db.prepare(`
      SELECT u.name AS user_name, sm.created_by_user_id,
             COUNT(*) AS count,
             COALESCE(SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END), 0) AS added,
             COALESCE(SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END), 0) AS removed
      FROM stock_movements sm
      JOIN users u ON u.id = sm.created_by_user_id
      WHERE date(sm.created_at) BETWEEN ? AND ?
      GROUP BY sm.created_by_user_id ORDER BY count DESC
    `).all(from, to);

    const byMedicine = db.prepare(`
      SELECT medicine_name, medicine_id,
             COUNT(*) AS count,
             COALESCE(SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END), 0) AS added,
             COALESCE(SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END), 0) AS removed
      FROM stock_movements
      WHERE date(created_at) BETWEEN ? AND ?
      GROUP BY medicine_id ORDER BY count DESC LIMIT 20
    `).all(from, to);

    const byDay = db.prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS count,
             COALESCE(SUM(CASE WHEN qty_change > 0 THEN qty_change ELSE 0 END), 0) AS added,
             COALESCE(SUM(CASE WHEN qty_change < 0 THEN ABS(qty_change) ELSE 0 END), 0) AS removed
      FROM stock_movements
      WHERE date(created_at) BETWEEN ? AND ?
      GROUP BY date(created_at) ORDER BY date ASC
    `).all(from, to);

    // Current stock snapshot — pharmacy + store
    const currentStock = db.prepare(`
      SELECT id, name, unit, stock_qty, stock_qty_store, low_stock_at, location, active
      FROM medicines ORDER BY name ASC
    `).all();

    return ok({ from, to, totals, byType, byUser, byMedicine, byDay, currentStock });
  } catch (err) { return handleApiError(err); }
}
