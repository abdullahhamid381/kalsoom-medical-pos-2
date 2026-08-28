import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';

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
        const from = sp.get('from') || new Date().toISOString().slice(0, 10);
        const to = sp.get('to') || new Date().toISOString().slice(0, 10);
        const rows = await db.prepare(`
      SELECT o.name AS organism, a.name AS antibiotic,
             SUM(CASE WHEN cs.result = 'S' THEN 1 ELSE 0 END) AS susceptible,
             COUNT(*) AS total
      FROM lab_culture_sensitivities cs
      JOIN lab_culture_organisms co ON co.id = cs.culture_organism_id
      JOIN lab_organisms o ON o.id = co.organism_id
      JOIN lab_antibiotics a ON a.id = cs.antibiotic_id
      JOIN lab_order_items loi ON loi.id = co.order_item_id
      JOIN lab_orders lo ON lo.id = loi.order_id
      WHERE LEFT(lo.created_at, 10) BETWEEN ? AND ?
      GROUP BY o.id, a.id
      ORDER BY o.name ASC, a.name ASC
    `).all(from, to);
        return ok({ from, to, rows });
    }
    catch (err) {
        return handleApiError(err);
    }
}
