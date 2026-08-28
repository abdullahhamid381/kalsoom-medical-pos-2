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
        const rec = await db.prepare(`
      SELECT sr.*, p.full_name AS patient_name, p.phone AS patient_phone,
        st.name AS surgery_name, d.name AS surgeon_name, u.name AS booked_by_name
      FROM surgery_records sr
      JOIN patients p ON p.id=sr.patient_id
      JOIN surgery_types st ON st.id=sr.surgery_type_id
      LEFT JOIN doctors d ON d.id=sr.surgeon_id
      JOIN users u ON u.id=sr.booked_by_user_id
      WHERE sr.id=?
    `).get(id) as any;
        if (!rec)
            return fail('Record not found.', 404);
        const clinic = getClinicInfo();
        const balance = Math.max(rec.total_cost - rec.discount - rec.paid_amount, 0);
        const msg = `*${clinic.name} — Surgery Receipt*\nNo: ${rec.surgery_no}\nDate: ${rec.surgery_date}${rec.surgery_time ? ` at ${rec.surgery_time}` : ''}\nPatient: ${rec.patient_name}${rec.patient_phone ? ` | ${rec.patient_phone}` : ''}\nSurgery: ${rec.surgery_name}\n${rec.surgeon_name ? `Surgeon: Dr. ${rec.surgeon_name}\n` : ''}${rec.theatre_no ? `Theatre: ${rec.theatre_no}\n` : ''}${rec.diagnosis ? `Dx: ${rec.diagnosis}\n` : ''}\n*Charges:*\nSurgeon: Rs.${rec.surgery_fee} | Anaesthesia: Rs.${rec.anesthesia_fee} | Theatre: Rs.${rec.theatre_fee}${rec.medicine_cost > 0 ? ` | Medicines: Rs.${rec.medicine_cost}` : ''}${rec.other_charges > 0 ? ` | Other: Rs.${rec.other_charges}` : ''}\n*Total: Rs.${rec.total_cost}*\n${rec.discount > 0 ? `Discount: Rs.${rec.discount}\n` : ''}Paid: Rs.${rec.paid_amount} (${rec.payment_status.toUpperCase()})\n${balance > 0 ? `Balance Due: Rs.${balance}\n` : ''}Status: ${rec.status.toUpperCase()}\n${clinic.phone}`;
        await db.prepare(`UPDATE surgery_records SET whatsapp_sent=1 WHERE id=?`).run(id);
        return ok({ shareLink: buildWhatsAppShareLink(rec.patient_phone || '', msg) });
    }
    catch (err) {
        return handleApiError(err);
    }
}
