import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';
import { buildWhatsAppShareLink } from '@/lib/whatsapp';
import { appointmentSelect } from '@/lib/appointments-query';
import { formatTime12h } from '@/lib/format';
export async function POST(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const appt = await db.prepare(`${appointmentSelect()} WHERE a.id = ?`).get(Number(params.id)) as any;
        if (!appt)
            return fail('Appointment not found.', 404);
        if (session.role === 'doctor' && appt.doctor_id !== session.doctorId)
            return fail('Not authorized.', 403);
        const clinic = getClinicInfo();
        const msg = `*${clinic.name} — Appointment Confirmation*\nNo: ${appt.appointment_no} | Token: #${appt.token_number}\nPatient: ${appt.patient_name} | Phone: ${appt.patient_phone}\nDoctor: Dr. ${appt.doctor_name} (${appt.specialization})\nDate: ${appt.appointment_date} at ${formatTime12h(appt.appointment_time)}\n${appt.reason ? `Reason: ${appt.reason}\n` : ''}Fee: Rs. ${appt.amount} | Paid: Rs. ${appt.paid_amount} (${appt.payment_status.toUpperCase()})\n${clinic.phone} | ${clinic.address}\nPlease arrive 15 minutes early.`;
        await db.prepare(`UPDATE appointments SET whatsapp_sent=1, whatsapp_sent_at=now_iso() WHERE id=?`).run(appt.id);
        return ok({ shareLink: buildWhatsAppShareLink(appt.patient_phone, msg) });
    }
    catch (err) {
        return handleApiError(err);
    }
}
