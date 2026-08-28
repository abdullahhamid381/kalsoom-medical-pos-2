import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'receptionist', 'receptionist_admin');
        const db = await getDb();
        const id = Number(params.id);
        const patient = await db.prepare(`SELECT * FROM patients WHERE id = ?`).get(id);
        if (!patient)
            return fail('Patient not found.', 404);
        const appointments = await db
            .prepare(`SELECT a.*, d.name AS doctor_name, d.specialization, u.name AS booked_by_name
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN users u ON u.id = a.booked_by_user_id
         WHERE a.patient_id = ?
         ORDER BY a.appointment_date DESC, a.appointment_time DESC`)
            .all(id);
        return ok({ patient, appointments });
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
        await requireRole('super_admin', 'receptionist', 'receptionist_admin');
        const id = Number(params.id);
        const body = await req.json();
        const db = await getDb();
        const updates: string[] = [];
        const values: any[] = [];
        const fields = ['full_name', 'phone', 'cnic', 'address'];
        for (const key of fields) {
            if (typeof body[key] === 'string') {
                updates.push(`${key} = ?`);
                values.push(body[key].trim());
            }
        }
        if (body.age !== undefined) {
            updates.push('age = ?');
            values.push(Number(body.age));
        }
        if (['Male', 'Female', 'Other'].includes(body.gender)) {
            updates.push('gender = ?');
            values.push(body.gender);
        }
        if (updates.length === 0)
            return fail('Nothing to update.');
        await db.prepare(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
        return ok({ updated: true });
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
        await requireRole('super_admin', 'receptionist', 'receptionist_admin');
        const id = Number(params.id);
        const db = await getDb();
        const patient = await db.prepare(`SELECT id FROM patients WHERE id = ?`).get(id);
        if (!patient)
            return fail('Patient not found.', 404);
        // Patients have no active/deactivate flag, so a delete is only safe when nothing
        // references this record yet - once any visit history exists it must stay for
        // appointment/lab/admission/sale record integrity.
        const refs: [
            string,
            string
        ][] = [
            ['appointments', 'patient_id'],
            ['admissions', 'patient_id'],
            ['surgery_records', 'patient_id'],
            ['lab_orders', 'patient_id'],
            ['pharmacy_sales', 'patient_id'],
            ['prescriptions', 'patient_id']
        ];
        for (const [table, column] of refs) {
            const row = await db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE ${column} = ?`).get(id) as {
                c: number;
            };
            if (row.c > 0) {
                return fail('This patient has existing visit records, so they cannot be deleted. Edit their details instead.');
            }
        }
        await db.prepare(`DELETE FROM patients WHERE id = ?`).run(id);
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
