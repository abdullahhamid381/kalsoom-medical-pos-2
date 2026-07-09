import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { appointmentSelect } from '@/lib/appointments-query';

// Used by the "Scan Patient" screen. A barcode scanner acts like a keyboard,
// typing the appointment number (the same text encoded in the slip's
// Code128 barcode) into a focused input and pressing Enter - so this just
// needs to look that exact code up, no camera/image decoding required.
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const db = getDb();
    const code = req.nextUrl.searchParams.get('code')?.trim();
    if (!code) return fail('Provide an appointment number to look up.');

    const appointment = db.prepare(`${appointmentSelect()} WHERE a.appointment_no = ?`).get(code) as any;
    if (!appointment) return fail('No appointment found for that code.', 404);

    if (session.role === 'doctor' && appointment.doctor_id !== session.doctorId) {
      return fail('This appointment belongs to a different doctor.', 403);
    }

    return ok({ appointment });
  } catch (err) {
    return handleApiError(err);
  }
}
