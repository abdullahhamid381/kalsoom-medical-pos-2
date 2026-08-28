import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { handleApiError, fail } from '@/lib/http';
import { generateReportPdf } from '@/lib/pdf';
import { getClinicInfo } from '@/lib/clinic';
import { appointmentSelect } from '@/lib/appointments-query';
export async function GET(req: NextRequest) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const from = sp.get('from') || new Date().toISOString().slice(0, 10);
        const to = sp.get('to') || new Date().toISOString().slice(0, 10);
        const doctorScope = session.role === 'doctor';
        if (doctorScope && !session.doctorId)
            return fail('Not authorized.', 403);
        const doctorClause = doctorScope ? 'AND a.doctor_id = ?' : '';
        const doctorParam = doctorScope ? [session.doctorId] : [];
        const totals = await db
            .prepare(`SELECT COUNT(*) AS total_appointments,
                COALESCE(SUM(paid_amount), 0) AS total_collected,
                COALESCE(SUM(amount - discount), 0) AS total_billed
         FROM appointments a
         WHERE a.appointment_date BETWEEN ? AND ? AND a.status != 'cancelled' ${doctorClause}`)
            .get(from, to, ...doctorParam) as any;
        const byPaymentMethod = await db
            .prepare(`SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(paid_amount), 0) AS collected
         FROM appointments a
         WHERE a.appointment_date BETWEEN ? AND ? AND a.status != 'cancelled' ${doctorClause}
         GROUP BY payment_method`)
            .all(from, to, ...doctorParam) as any[];
        const byDoctor = await db
            .prepare(`SELECT d.name AS doctor_name, COUNT(*) AS count, COALESCE(SUM(a.paid_amount), 0) AS collected
         FROM appointments a JOIN doctors d ON d.id = a.doctor_id
         WHERE a.appointment_date BETWEEN ? AND ? AND a.status != 'cancelled' ${doctorClause}
         GROUP BY a.doctor_id, d.name ORDER BY count DESC`)
            .all(from, to, ...doctorParam) as any[];
        const byUser = await db
            .prepare(`SELECT u.name AS user_name, COUNT(*) AS count, COALESCE(SUM(a.paid_amount), 0) AS collected
         FROM appointments a JOIN users u ON u.id = a.booked_by_user_id
         WHERE a.appointment_date BETWEEN ? AND ? AND a.status != 'cancelled' ${doctorClause}
         GROUP BY a.booked_by_user_id, u.name ORDER BY count DESC`)
            .all(from, to, ...doctorParam) as any[];
        const apptConditions = [`a.appointment_date >= ?`, `a.appointment_date <= ?`];
        const apptValues: any[] = [from, to];
        if (doctorScope) {
            apptConditions.push('a.doctor_id = ?');
            apptValues.push(session.doctorId);
        }
        const appointments = await db
            .prepare(`${appointmentSelect()} WHERE ${apptConditions.join(' AND ')} ORDER BY a.appointment_date DESC, a.token_number ASC LIMIT 2000`)
            .all(...apptValues) as any[];
        const pdfBuffer = await generateReportPdf({
            clinic: getClinicInfo(),
            from,
            to,
            totals,
            byPaymentMethod,
            byDoctor,
            byUser,
            appointments
        });
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="KMC-Report-${from}-to-${to}.pdf"`
            }
        });
    }
    catch (err) {
        return handleApiError(err);
    }
}
