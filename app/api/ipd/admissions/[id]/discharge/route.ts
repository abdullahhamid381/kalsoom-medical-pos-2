import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { syncAutoRoomCharge } from '@/lib/ipdCharges';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const b = await req.json();
        const adm = await db.prepare(`SELECT * FROM admissions WHERE id = ?`).get(id) as any;
        if (!adm)
            return fail('Admission not found.', 404);
        if (adm.status !== 'admitted')
            return fail('Patient is not currently admitted.');
        const now = new Date();
        const dischargeDate = b.discharge_date || now.toISOString().slice(0, 10);
        const dischargeTime = b.discharge_time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        // Calculate days stayed
        const admitMs = new Date(`${adm.admission_date}T${adm.admission_time}`).getTime();
        const dischargeMs = new Date(`${dischargeDate}T${dischargeTime}`).getTime();
        const daysStayed = Math.max(1, Math.ceil((dischargeMs - admitMs) / (1000 * 60 * 60 * 24)));
        // Lock in the final room fee (days stayed x rate) as of the actual discharge date/time.
        await syncAutoRoomCharge(db, id, dischargeDate, dischargeTime, session.id);
        // Aggregate charges by type
        const chargeAgg = await db.prepare(`
      SELECT charge_type, COALESCE(SUM(total), 0) AS subtotal
      FROM admission_charges WHERE admission_id = ? GROUP BY charge_type
    `).all(id) as {
            charge_type: string;
            subtotal: number;
        }[];
        const totals: Record<string, number> = {};
        for (const row of chargeAgg)
            totals[row.charge_type] = row.subtotal;
        const grand_total = Object.values(totals).reduce((s, v) => s + v, 0);
        const discount = Number(b.discount || 0);
        const net = Math.max(grand_total - discount, 0);
        const paid_amount = Number(b.paid_amount || 0);
        const payment_status = paid_amount >= net && net > 0 ? 'paid' : paid_amount > 0 ? 'partial' : 'unpaid';
        const tx = db.transaction(async () => {
            await db.prepare(`
        UPDATE admissions SET
          status = 'discharged', discharge_date = ?, discharge_time = ?, days_stayed = ?,
          room_charge_total = ?, medicine_total = ?, lab_total = ?,
          procedure_total = ?, other_total = ?, grand_total = ?,
          discount = ?, paid_amount = ?, payment_status = ?, payment_method = ?,
          updated_at = now_iso()
        WHERE id = ?
      `).run(dischargeDate, dischargeTime, daysStayed, totals['room'] || 0, (totals['medicine'] || 0) + (totals['nursing'] || 0), totals['lab'] || 0, totals['procedure'] || 0, (totals['doctor_fee'] || 0) + (totals['other'] || 0), grand_total, discount, paid_amount, payment_status, b.payment_method || 'cash', id);
            // Free the room
            await db.prepare(`UPDATE rooms SET status = 'available' WHERE id = ?`).run(adm.room_id);
        });
        await tx();
        const admission = await db.prepare(`
      SELECT a.*, p.full_name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender, p.cnic AS patient_cnic,
        r.room_no, r.room_type, r.floor, d.name AS doctor_name, u.name AS admitted_by_name
      FROM admissions a JOIN patients p ON p.id = a.patient_id JOIN rooms r ON r.id = a.room_id
      LEFT JOIN doctors d ON d.id = a.doctor_id JOIN users u ON u.id = a.admitted_by_user_id
      WHERE a.id = ?
    `).get(id);
        return ok({ admission });
    }
    catch (err) {
        return handleApiError(err);
    }
}
