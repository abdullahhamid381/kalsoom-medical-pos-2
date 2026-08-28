import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const from = sp.get('from') || new Date().toISOString().slice(0, 10);
        const to = sp.get('to') || new Date().toISOString().slice(0, 10);
        // Doctors only ever see reports scoped to their own appointments.
        const doctorScope = session.role === 'doctor';
        if (doctorScope && !session.doctorId) {
            return ok({
                from,
                to,
                totals: { total_appointments: 0, total_collected: 0, total_billed: 0 },
                byPaymentMethod: [],
                byDoctor: [],
                byUser: [],
                byStatus: [],
                byDay: []
            });
        }
        const doctorClause = doctorScope ? 'AND a.doctor_id = ?' : '';
        const doctorParam = doctorScope ? [session.doctorId] : [];
        const totals = await db
            .prepare(`SELECT COUNT(*) AS total_appointments,
                COALESCE(SUM(paid_amount), 0) AS total_collected,
                COALESCE(SUM(amount - discount), 0) AS total_billed
         FROM appointments a
         WHERE a.appointment_date BETWEEN ? AND ? AND a.status != 'cancelled' ${doctorClause}`)
            .get(from, to, ...doctorParam);
        const byPaymentMethod = await db
            .prepare(`SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(paid_amount), 0) AS collected
         FROM appointments a
         WHERE a.appointment_date BETWEEN ? AND ? AND a.status != 'cancelled' ${doctorClause}
         GROUP BY payment_method`)
            .all(from, to, ...doctorParam);
        const byDoctor = await db
            .prepare(`SELECT d.name AS doctor_name, COUNT(*) AS count, COALESCE(SUM(a.paid_amount), 0) AS collected
         FROM appointments a JOIN doctors d ON d.id = a.doctor_id
         WHERE a.appointment_date BETWEEN ? AND ? AND a.status != 'cancelled' ${doctorClause}
         GROUP BY a.doctor_id, d.name ORDER BY count DESC`)
            .all(from, to, ...doctorParam);
        const byUser = await db
            .prepare(`SELECT u.name AS user_name, COUNT(*) AS count, COALESCE(SUM(a.paid_amount), 0) AS collected
         FROM appointments a JOIN users u ON u.id = a.booked_by_user_id
         WHERE a.appointment_date BETWEEN ? AND ? AND a.status != 'cancelled' ${doctorClause}
         GROUP BY a.booked_by_user_id, u.name ORDER BY count DESC`)
            .all(from, to, ...doctorParam);
        const byStatus = await db
            .prepare(`SELECT status, COUNT(*) AS count FROM appointments a
         WHERE a.appointment_date BETWEEN ? AND ? ${doctorClause}
         GROUP BY status`)
            .all(from, to, ...doctorParam);
        const byDay = await db
            .prepare(`SELECT a.appointment_date AS date, COUNT(*) AS count, COALESCE(SUM(a.paid_amount), 0) AS collected
         FROM appointments a
         WHERE a.appointment_date BETWEEN ? AND ? AND a.status != 'cancelled' ${doctorClause}
         GROUP BY a.appointment_date ORDER BY a.appointment_date ASC`)
            .all(from, to, ...doctorParam);
        return ok({ from, to, totals, byPaymentMethod, byDoctor, byUser, byStatus, byDay });
    }
    catch (err) {
        return handleApiError(err);
    }
}
