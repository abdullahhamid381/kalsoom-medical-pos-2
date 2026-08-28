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
        await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
        const db = await getDb();
        const status = req.nextUrl.searchParams.get('status');
        const conds: string[] = [];
        const vals: any[] = [];
        if (status) {
            conds.push('hc.status = ?');
            vals.push(status);
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const collections = await db.prepare(`
      SELECT hc.*, lo.order_no, lo.patient_name, lo.patient_phone, lo.priority, u.name AS collector_name
      FROM lab_home_collections hc
      JOIN lab_orders lo ON lo.id = hc.order_id
      LEFT JOIN users u ON u.id = hc.collector_user_id
      ${where}
      ORDER BY (hc.scheduled_at IS NULL), hc.scheduled_at ASC, hc.created_at ASC
    `).all(...vals);
        return ok({ collections });
    }
    catch (err) {
        return handleApiError(err);
    }
}
