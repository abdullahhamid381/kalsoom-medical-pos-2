import { NextRequest } from 'next/server';
import { getDb, nextTokenNumber } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { appointmentSelect } from '@/lib/appointments-query';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
const STATUSES = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'];
const PAYMENT_METHODS = ['cash', 'jazzcash', 'easypaisa', 'bank_transfer', 'card'];
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const appointment = await db.prepare(`${appointmentSelect()} WHERE a.id = ?`).get(Number(params.id)) as any;
        if (!appointment)
            return fail('Appointment not found.', 404);
        if (session.role === 'doctor' && appointment.doctor_id !== session.doctorId) {
            return fail('Not authorized to view this appointment.', 403);
        }
        return ok({ appointment });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function PUT(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireSession();
        const id = Number(params.id);
        const body = await req.json();
        const db = await getDb();
        const existing = await db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(id) as any;
        if (!existing)
            return fail('Appointment not found.', 404);
        if (session.role === 'doctor') {
            if (existing.doctor_id !== session.doctorId)
                return fail('Not authorized to update this appointment.', 403);
            // Doctors can only move their own appointment's status forward
            // (e.g. scanning a patient's barcode in to mark checked-in/completed) -
            // they can't edit booking details, payment, or schedule.
            if (!STATUSES.includes(body.status))
                return fail('Doctors can only update appointment status.');
            await db.prepare(`UPDATE appointments SET status = ?, updated_at = now_iso() WHERE id = ?`).run(body.status, id);
            const appointment = await db.prepare(`${appointmentSelect()} WHERE a.id = ?`).get(id);
            return ok({ appointment });
        }
        const updates: string[] = [];
        const values: any[] = [];
        let doctorId = existing.doctor_id;
        if (typeof body.doctor_id !== 'undefined' && body.doctor_id !== null) {
            const doctor = await db.prepare(`SELECT * FROM doctors WHERE id = ?`).get(Number(body.doctor_id)) as any;
            if (!doctor)
                return fail('Selected doctor was not found.');
            doctorId = doctor.id;
            updates.push('doctor_id = ?');
            values.push(doctor.id);
        }
        const appointmentDate = typeof body.appointment_date === 'string' ? body.appointment_date : existing.appointment_date;
        // Moving to a different doctor or a different day re-queues the patient - they get a
        // fresh token for that doctor's queue on that day (pure token/queue system, no time slots).
        const queueChanged = doctorId !== existing.doctor_id || appointmentDate !== existing.appointment_date;
        if (queueChanged) {
            const token_number = await nextTokenNumber(db, doctorId, appointmentDate);
            updates.push('token_number = ?');
            values.push(token_number);
        }
        if (typeof body.appointment_date === 'string') {
            updates.push('appointment_date = ?');
            values.push(body.appointment_date);
        }
        if (typeof body.appointment_time === 'string') {
            updates.push('appointment_time = ?');
            values.push(body.appointment_time);
        }
        if (typeof body.department === 'string') {
            updates.push('department = ?');
            values.push(body.department);
        }
        if (typeof body.reason === 'string') {
            updates.push('reason = ?');
            values.push(body.reason);
        }
        if (typeof body.notes === 'string') {
            updates.push('notes = ?');
            values.push(body.notes);
        }
        if (STATUSES.includes(body.status)) {
            updates.push('status = ?');
            values.push(body.status);
        }
        if (PAYMENT_METHODS.includes(body.payment_method)) {
            updates.push('payment_method = ?');
            values.push(body.payment_method);
        }
        if (body.amount !== undefined) {
            updates.push('amount = ?');
            values.push(Number(body.amount));
        }
        if (body.discount !== undefined) {
            updates.push('discount = ?');
            values.push(Number(body.discount));
        }
        if (body.paid_amount !== undefined) {
            const amount = body.amount !== undefined ? Number(body.amount) : existing.amount;
            const discount = body.discount !== undefined ? Number(body.discount) : existing.discount;
            const paid = Number(body.paid_amount);
            updates.push('paid_amount = ?');
            values.push(paid);
            const status = paid >= amount - discount && amount - discount > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
            updates.push('payment_status = ?');
            values.push(status);
        }
        if (updates.length === 0)
            return fail('Nothing to update.');
        updates.push("updated_at = now_iso()");
        await db.prepare(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
        const appointment = await db.prepare(`${appointmentSelect()} WHERE a.id = ?`).get(id);
        return ok({ appointment });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function DELETE(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        // Only super admin can permanently remove a booking; receptionists should cancel instead.
        await requireRole('super_admin');
        const db = await getDb();
        await db.prepare(`DELETE FROM appointments WHERE id = ?`).run(Number(params.id));
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
