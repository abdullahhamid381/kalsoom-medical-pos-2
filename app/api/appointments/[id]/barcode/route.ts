import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { generateBarcodePng } from '@/lib/barcode';

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
        const session = await requireSession();
        const db = await getDb();
        const appt = await db.prepare(`SELECT appointment_no, doctor_id FROM appointments WHERE id = ?`).get(Number(params.id)) as {
            appointment_no: string;
            doctor_id: number;
        } | undefined;
        if (!appt)
            return fail('Appointment not found.', 404);
        if (session.role === 'doctor' && appt.doctor_id !== session.doctorId) {
            return fail('Not authorized to view this appointment.', 403);
        }
        const png = await generateBarcodePng(appt.appointment_no);
        return new NextResponse(png, {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-store'
            }
        });
    }
    catch (err) {
        return handleApiError(err);
    }
}
