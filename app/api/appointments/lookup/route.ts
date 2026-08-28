import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { appointmentSelect } from '@/lib/appointments-query';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
// Used by the "Scan Patient" screen. A barcode scanner acts like a keyboard,
// typing the appointment number (the same text encoded in the slip's
// Code128 barcode) into a focused input and pressing Enter - so this just
// needs to look that exact code up, no camera/image decoding required.
export async function GET(req: NextRequest) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const code = req.nextUrl.searchParams.get('code')?.trim();
        if (!code)
            return fail('Provide an appointment number to look up.');
        const appointment = await db.prepare(`${appointmentSelect()} WHERE a.appointment_no = ?`).get(code) as any;
        if (!appointment)
            return fail('No appointment found for that code.', 404);
        if (session.role === 'doctor' && appointment.doctor_id !== session.doctorId) {
            return fail('This appointment belongs to a different doctor.', 403);
        }
        return ok({ appointment });
    }
    catch (err) {
        return handleApiError(err);
    }
}
