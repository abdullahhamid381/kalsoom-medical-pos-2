import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, hashPassword } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

const ROLES = ['super_admin', 'receptionist', 'doctor', 'pharmacy_admin', 'sales_person', 'lab_technician', 'ward_admin', 'lab_senior_technologist', 'lab_pathologist'];

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole('super_admin');
    const db = getDb();
    const id = Number(params.id);
    const body = await req.json();

    if (id === session.id && body.active === false) {
      return fail('You cannot deactivate your own account.');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }
    if (typeof body.active === 'boolean') {
      updates.push('active = ?');
      values.push(body.active ? 1 : 0);
    }
    if (typeof body.role === 'string' && ROLES.includes(body.role)) {
      updates.push('role = ?');
      values.push(body.role);

      if (body.role === 'doctor') {
        const doctorId = Number(body.doctor_id);
        if (!doctorId) return fail('Select which doctor this login belongs to.');
        const doctor = db.prepare(`SELECT id FROM doctors WHERE id = ?`).get(doctorId);
        if (!doctor) return fail('Selected doctor was not found.');
        const alreadyLinked = db.prepare(`SELECT id FROM users WHERE doctor_id = ? AND id != ?`).get(doctorId, id);
        if (alreadyLinked) return fail('This doctor already has a login account.');
        updates.push('doctor_id = ?');
        values.push(doctorId);
      } else {
        updates.push('doctor_id = ?');
        values.push(null);
      }
    }
    if (typeof body.password === 'string' && body.password.length > 0) {
      if (body.password.length < 6) return fail('Password must be at least 6 characters.');
      updates.push('password_hash = ?');
      values.push(await hashPassword(body.password));
    }

    if (updates.length === 0) return fail('Nothing to update.');

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
    return ok({ updated: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole('super_admin');
    const id = Number(params.id);
    if (id === session.id) return fail('You cannot delete your own account.');

    const db = getDb();
    const bookingCount = db.prepare(`SELECT COUNT(*) AS c FROM appointments WHERE booked_by_user_id = ?`).get(id) as {
      c: number;
    };
    if (bookingCount.c > 0) {
      // Keep appointment history intact - deactivate instead of hard delete.
      db.prepare(`UPDATE users SET active = 0 WHERE id = ?`).run(id);
      return ok({ deactivated: true, reason: 'User has existing bookings, so the account was deactivated instead of deleted to preserve appointment records.' });
    }

    db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
