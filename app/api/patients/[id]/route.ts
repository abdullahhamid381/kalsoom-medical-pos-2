import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin', 'receptionist');
    const db = getDb();
    const id = Number(params.id);
    const patient = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(id);
    if (!patient) return fail('Patient not found.', 404);

    const appointments = db
      .prepare(
        `SELECT a.*, d.name AS doctor_name, d.specialization, u.name AS booked_by_name
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN users u ON u.id = a.booked_by_user_id
         WHERE a.patient_id = ?
         ORDER BY a.appointment_date DESC, a.appointment_time DESC`
      )
      .all(id);

    return ok({ patient, appointments });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin', 'receptionist');
    const id = Number(params.id);
    const body = await req.json();
    const db = getDb();

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
    if (updates.length === 0) return fail('Nothing to update.');

    db.prepare(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
    return ok({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}
