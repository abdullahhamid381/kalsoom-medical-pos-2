import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function GET(req: NextRequest) {
  try {
    await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
    const db = getDb();
    const all = req.nextUrl.searchParams.get('all') === '1';
    const where = all ? '' : 'WHERE active = 1';
    const reagents = db.prepare(`SELECT * FROM lab_reagents ${where} ORDER BY name ASC`).all() as any[];
    for (const r of reagents) {
      r.batches = db.prepare(`SELECT * FROM lab_reagent_batches WHERE reagent_id = ? AND active = 1 ORDER BY expiry_date ASC`).all(r.id);
    }
    const lowStock = reagents.filter((r) => r.stock_qty <= r.low_stock_at);
    const expiringSoon = db.prepare(`
      SELECT b.*, r.name AS reagent_name FROM lab_reagent_batches b
      JOIN lab_reagents r ON r.id = b.reagent_id
      WHERE b.active = 1 AND b.expiry_date <= date('now', '+30 days')
      ORDER BY b.expiry_date ASC
    `).all();
    return ok({ reagents, lowStock, expiringSoon });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('super_admin');
    const b = await req.json();
    const name = String(b.name || '').trim();
    if (!name) return fail('Reagent name is required.');
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO lab_reagents (name, unit, stock_qty, low_stock_at) VALUES (?, ?, ?, ?)`
    ).run(name, b.unit || 'ml', Number(b.stock_qty || 0), Number(b.low_stock_at || 10));
    return ok({ id: result.lastInsertRowid }, 201);
  } catch (err) { return handleApiError(err); }
}
