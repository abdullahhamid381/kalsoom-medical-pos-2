import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
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
      SELECT COUNT(*) AS total_orders,
             COALESCE(SUM(total), 0) AS total_billed,
             COALESCE(SUM(paid_amount), 0) AS total_collected
      FROM lab_orders WHERE date(created_at) BETWEEN ? AND ? AND status != 'cancelled'
    `).get(from, to);

    const byStatus = db.prepare(`
      SELECT status, COUNT(*) AS count FROM lab_orders
      WHERE date(created_at) BETWEEN ? AND ? GROUP BY status
    `).all(from, to);

    const byPaymentMethod = db.prepare(`
      SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(paid_amount), 0) AS collected
      FROM lab_orders WHERE date(created_at) BETWEEN ? AND ? AND status != 'cancelled'
      GROUP BY payment_method
    `).all(from, to);

    const byUser = db.prepare(`
      SELECT u.name AS user_name, COUNT(*) AS count, COALESCE(SUM(lo.paid_amount), 0) AS collected
      FROM lab_orders lo JOIN users u ON u.id = lo.booked_by_user_id
      WHERE date(lo.created_at) BETWEEN ? AND ? AND lo.status != 'cancelled'
      GROUP BY lo.booked_by_user_id ORDER BY count DESC
    `).all(from, to);

    const byDay = db.prepare(`
      SELECT date(created_at) AS date, COUNT(*) AS count,
             COALESCE(SUM(paid_amount), 0) AS collected
      FROM lab_orders WHERE date(created_at) BETWEEN ? AND ? AND status != 'cancelled'
      GROUP BY date(created_at) ORDER BY date ASC
    `).all(from, to);

    const topTests = db.prepare(`
      SELECT loi.test_name, COUNT(*) AS count, COALESCE(SUM(loi.price), 0) AS revenue
      FROM lab_order_items loi JOIN lab_orders lo ON lo.id = loi.order_id
      WHERE date(lo.created_at) BETWEEN ? AND ? AND lo.status != 'cancelled'
      GROUP BY loi.test_name ORDER BY count DESC LIMIT 10
    `).all(from, to);

    // TAT compliance — v1 simplification: order-level timing (created_at -> reported_at)
    // against the order's slowest test's SLA, not true per-item/per-sample timing.
    const tat = db.prepare(`
      SELECT COUNT(*) AS total_reported,
             AVG((julianday(reported_at) - julianday(created_at)) * 24) AS avg_hours,
             SUM(CASE WHEN (julianday(reported_at) - julianday(created_at)) * 24 > sla_hours THEN 1 ELSE 0 END) AS breach_count
      FROM (
        SELECT lo.created_at, lo.reported_at,
               (SELECT MAX(lt.turnaround_hours) FROM lab_order_items loi JOIN lab_tests lt ON lt.id = loi.test_id WHERE loi.order_id = lo.id) AS sla_hours
        FROM lab_orders lo
        WHERE lo.report_status = 'reported' AND date(lo.created_at) BETWEEN ? AND ?
      ) t
      WHERE sla_hours IS NOT NULL
    `).get(from, to) as any;

    const byReferringDoctor = db.prepare(`
      SELECT COALESCE(rd.name, lo.referring_doctor, 'Walk-in / Unspecified') AS doctor_name,
             rd.commission_percent AS commission_percent,
             COUNT(*) AS count, COALESCE(SUM(lo.total), 0) AS revenue
      FROM lab_orders lo LEFT JOIN lab_referring_doctors rd ON rd.id = lo.referring_doctor_id
      WHERE date(lo.created_at) BETWEEN ? AND ? AND lo.status != 'cancelled'
        AND (rd.id IS NOT NULL OR lo.referring_doctor IS NOT NULL)
      GROUP BY COALESCE(rd.id, lo.referring_doctor) ORDER BY revenue DESC LIMIT 15
    `).all(from, to).map((r: any) => ({
      ...r,
      commission_amount: r.commission_percent ? Math.round(r.revenue * r.commission_percent) / 100 : 0
    }));

    const rejectedSamples = db.prepare(`
      SELECT COALESCE(rejection_reason, 'Unspecified') AS reason, COUNT(*) AS count
      FROM lab_samples WHERE status = 'rejected' AND date(created_at) BETWEEN ? AND ?
      GROUP BY COALESCE(rejection_reason, 'Unspecified') ORDER BY count DESC
    `).all(from, to);

    const totalSamples = db.prepare(`
      SELECT COUNT(*) AS c FROM lab_samples WHERE date(created_at) BETWEEN ? AND ?
    `).get(from, to) as { c: number };
    const rejectedCount = (rejectedSamples as any[]).reduce((s, r) => s + r.count, 0);

    return ok({
      from, to, totals, byStatus, byPaymentMethod, byUser, byDay, topTests,
      tat: {
        avg_hours: tat?.avg_hours ?? null,
        breach_count: tat?.breach_count ?? 0,
        total_reported: tat?.total_reported ?? 0,
        breach_rate: tat?.total_reported ? (tat.breach_count / tat.total_reported) : 0
      },
      byReferringDoctor,
      rejectedSamples: {
        byReason: rejectedSamples,
        rejected_count: rejectedCount,
        total_samples: totalSamples.c,
        rejection_rate: totalSamples.c ? rejectedCount / totalSamples.c : 0
      }
    });
  } catch (err) { return handleApiError(err); }
}
