import { NextRequest } from 'next/server';
import { getDb, nextAppointmentNo, nextTokenNumber } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { appointmentSelect } from '@/lib/appointments-query';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
const PAYMENT_METHODS = ['cash', 'jazzcash', 'easypaisa', 'bank_transfer', 'card'];
export async function GET(req: NextRequest) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const conditions: string[] = [];
        const values: any[] = [];
        const date = sp.get('date');
        const from = sp.get('from');
        const to = sp.get('to');
        const doctorId = sp.get('doctor_id');
        const status = sp.get('status');
        const paymentStatus = sp.get('payment_status');
        const q = sp.get('q')?.trim();
        if (date) {
            conditions.push('a.appointment_date = ?');
            values.push(date);
        }
        if (from) {
            conditions.push('a.appointment_date >= ?');
            values.push(from);
        }
        if (to) {
            conditions.push('a.appointment_date <= ?');
            values.push(to);
        }
        if (session.role === 'doctor') {
            // Doctors only ever see their own patients - this overrides any
            // doctor_id the client tried to pass, intentionally.
            if (!session.doctorId)
                return ok({ appointments: [] });
            conditions.push('a.doctor_id = ?');
            values.push(session.doctorId);
        }
        else if (doctorId) {
            conditions.push('a.doctor_id = ?');
            values.push(Number(doctorId));
        }
        if (status) {
            conditions.push('a.status = ?');
            values.push(status);
        }
        if (paymentStatus) {
            conditions.push('a.payment_status = ?');
            values.push(paymentStatus);
        }
        if (q) {
            conditions.push('(p.full_name LIKE ? OR p.phone LIKE ? OR a.appointment_no LIKE ?)');
            values.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `${appointmentSelect()} ${where} ORDER BY a.appointment_date DESC, a.token_number ASC LIMIT 500`;
        const appointments = await db.prepare(sql).all(...values);
        return ok({ appointments });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        const session = await requireSession();
        if (session.role === 'doctor')
            return fail('Doctors cannot create bookings - ask a receptionist.', 403);
        const body = await req.json();
        const db = await getDb();
        let patientId: number;
        if (body.patient_id) {
            const existing = await db.prepare(`SELECT id FROM patients WHERE id = ?`).get(Number(body.patient_id));
            if (!existing)
                return fail('Selected patient was not found.');
            patientId = Number(body.patient_id);
            if (body.newPatient) {
                // allow inline edits to the existing patient at booking time
            }
        }
        else if (body.newPatient) {
            const np = body.newPatient;
            const full_name = String(np.full_name || '').trim();
            const phone = String(np.phone || '').trim();
            if (!full_name || !phone)
                return fail('Patient name and phone number are required.');
            const result = await db
                .prepare(`INSERT INTO patients (full_name, phone, cnic, age, gender, address) VALUES (?, ?, ?, ?, ?, ?)`)
                .run(full_name, phone, np.cnic ? String(np.cnic).trim() : null, np.age ? Number(np.age) : null, ['Male', 'Female', 'Other'].includes(np.gender) ? np.gender : 'Other', np.address ? String(np.address).trim() : null);
            patientId = Number(result.lastInsertRowid);
        }
        else {
            return fail('Provide either an existing patient_id or newPatient details.');
        }
        const doctor = await db.prepare(`SELECT * FROM doctors WHERE id = ? AND active = 1`).get(Number(body.doctor_id)) as any | undefined;
        if (!doctor)
            return fail('Selected doctor was not found or is inactive.');
        const appointment_date = String(body.appointment_date || '').trim();
        if (!appointment_date)
            return fail('Appointment date is required.');
        // Pure token/queue system - the exact time isn't chosen by staff, it's just a
        // timestamp of when the token was issued (still stored since it's useful for
        // sorting/records, but it plays no role in booking logic or slot validation).
        const now = new Date();
        const appointment_time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const payment_method = PAYMENT_METHODS.includes(body.payment_method) ? body.payment_method : 'cash';
        const amount = Number(body.amount ?? doctor.fee ?? 0);
        const discount = Number(body.discount ?? 0);
        const paid_amount = Number(body.paid_amount ?? amount - discount);
        const payment_status = paid_amount >= amount - discount && amount - discount > 0
            ? 'paid'
            : paid_amount > 0
                ? 'partial'
                : 'unpaid';
        const appointment_no = await nextAppointmentNo(db, appointment_date);
        const token_number = await nextTokenNumber(db, doctor.id, appointment_date);
        const result = await db
            .prepare(`INSERT INTO appointments
          (appointment_no, token_number, patient_id, doctor_id, booked_by_user_id, appointment_date, appointment_time,
           department, reason, payment_method, amount, discount, paid_amount, payment_status, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`)
            .run(appointment_no, token_number, patientId, doctor.id, session.id, appointment_date, appointment_time, body.department ? String(body.department).trim() : doctor.department, body.reason ? String(body.reason).trim() : null, payment_method, amount, discount, paid_amount, payment_status, body.notes ? String(body.notes).trim() : null);
        const appointment = await db
            .prepare(`${appointmentSelect()} WHERE a.id = ?`)
            .get(result.lastInsertRowid);
        return ok({ appointment }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
