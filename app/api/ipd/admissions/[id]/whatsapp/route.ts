import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';
import { buildWhatsAppShareLink } from '@/lib/whatsapp';
export async function POST(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const adm = await db.prepare(`SELECT a.*, p.full_name AS patient_name, p.phone AS patient_phone, r.room_no, r.room_type, d.name AS doctor_name, u.name AS admitted_by_name FROM admissions a JOIN patients p ON p.id=a.patient_id JOIN rooms r ON r.id=a.room_id LEFT JOIN doctors d ON d.id=a.doctor_id JOIN users u ON u.id=a.admitted_by_user_id WHERE a.id=?`).get(id) as any;
        if (!adm)
            return fail('Admission not found.', 404);
        const clinic = getClinicInfo();
        const isD = adm.status === 'discharged';
        const balance = Math.max(adm.grand_total - adm.discount - adm.paid_amount, 0);
        const msg = isD
            ? `*${clinic.name} — Discharge Summary*\nNo: ${adm.admission_no}\nPatient: ${adm.patient_name}\nRoom: ${adm.room_no} (${adm.room_type?.replace('_', ' ')})\n${adm.doctor_name ? `Doctor: Dr.${adm.doctor_name}\n` : ''}Admitted: ${adm.admission_date} | Discharged: ${adm.discharge_date}\nDays: ${adm.days_stayed}\n\nRoom: Rs.${adm.room_charge_total} | Medicine: Rs.${adm.medicine_total} | Lab: Rs.${adm.lab_total}\nProcedure: Rs.${adm.procedure_total} | Other: Rs.${adm.other_total}\n*Grand Total: Rs.${adm.grand_total}*\n${adm.discount > 0 ? `Discount: Rs.${adm.discount}\n` : ''}Paid: Rs.${adm.paid_amount} (${adm.payment_status.toUpperCase()})\n${balance > 0 ? `Balance Due: Rs.${balance}\n` : ''}${clinic.phone}`
            : `*${clinic.name} — Admission Confirmation*\nNo: ${adm.admission_no}\nPatient: ${adm.patient_name}\nRoom: ${adm.room_no} (${adm.room_type?.replace('_', ' ')})\n${adm.doctor_name ? `Doctor: Dr.${adm.doctor_name}\n` : ''}Admitted: ${adm.admission_date} at ${adm.admission_time}\n${adm.diagnosis ? `Diagnosis: ${adm.diagnosis}\n` : ''}${clinic.phone}`;
        await db.prepare(`UPDATE admissions SET whatsapp_sent=1 WHERE id=?`).run(id);
        return ok({ shareLink: buildWhatsAppShareLink(adm.patient_phone || '', msg) });
    }
    catch (err) {
        return handleApiError(err);
    }
}
