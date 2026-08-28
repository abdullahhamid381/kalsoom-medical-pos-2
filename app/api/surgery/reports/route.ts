import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const from = req.nextUrl.searchParams.get('from') || new Date().toISOString().slice(0, 10);
        const to = req.nextUrl.searchParams.get('to') || new Date().toISOString().slice(0, 10);
        const totals = await db.prepare(`
      SELECT COUNT(*) AS total_surgeries,
        COALESCE(SUM(total_cost),0) AS total_billed,
        COALESCE(SUM(paid_amount),0) AS total_collected,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END) AS scheduled,
        SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled
      FROM surgery_records WHERE surgery_date BETWEEN ? AND ?
    `).get(from, to);
        const byType = await db.prepare(`
      SELECT st.name, st.category, COUNT(*) AS count, COALESCE(SUM(sr.total_cost),0) AS revenue, COALESCE(SUM(sr.paid_amount),0) AS collected
      FROM surgery_records sr JOIN surgery_types st ON st.id=sr.surgery_type_id
      WHERE sr.surgery_date BETWEEN ? AND ?
      GROUP BY sr.surgery_type_id, st.name, st.category ORDER BY count DESC
    `).all(from, to);
        const bySurgeon = await db.prepare(`
      SELECT COALESCE(d.name, 'Unassigned') AS surgeon_name, COUNT(*) AS count, COALESCE(SUM(sr.total_cost),0) AS revenue
      FROM surgery_records sr LEFT JOIN doctors d ON d.id=sr.surgeon_id
      WHERE sr.surgery_date BETWEEN ? AND ?
      GROUP BY sr.surgeon_id, d.id ORDER BY count DESC
    `).all(from, to);
        const byDay = await db.prepare(`
      SELECT surgery_date AS date, COUNT(*) AS count, COALESCE(SUM(paid_amount),0) AS collected
      FROM surgery_records WHERE surgery_date BETWEEN ? AND ?
      GROUP BY surgery_date ORDER BY surgery_date
    `).all(from, to);
        return ok({ from, to, totals, byType, bySurgeon, byDay });
    }
    catch (err) {
        return handleApiError(err);
    }
}
