import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
        const db = await getDb();
        const all = req.nextUrl.searchParams.get('all') === '1';
        const where = all ? '' : 'WHERE active = 1';
        const reagents = await db.prepare(`SELECT * FROM lab_reagents ${where} ORDER BY name ASC`).all() as any[];
        for (const r of reagents) {
            r.batches = await db.prepare(`SELECT * FROM lab_reagent_batches WHERE reagent_id = ? AND active = 1 ORDER BY expiry_date ASC`).all(r.id);
        }
        const lowStock = reagents.filter((r) => r.stock_qty <= r.low_stock_at);
        const expiringSoon = await db.prepare(`
      SELECT b.*, r.name AS reagent_name FROM lab_reagent_batches b
      JOIN lab_reagents r ON r.id = b.reagent_id
      WHERE b.active = 1 AND b.expiry_date <= today_plus_iso(30)
      ORDER BY b.expiry_date ASC
    `).all();
        return ok({ reagents, lowStock, expiringSoon });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        await requireRole('super_admin');
        const b = await req.json();
        const name = String(b.name || '').trim();
        if (!name)
            return fail('Reagent name is required.');
        const db = await getDb();
        const result = await db.prepare(`INSERT INTO lab_reagents (name, unit, stock_qty, low_stock_at) VALUES (?, ?, ?, ?)`).run(name, b.unit || 'ml', Number(b.stock_qty || 0), Number(b.low_stock_at || 10));
        return ok({ id: result.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
