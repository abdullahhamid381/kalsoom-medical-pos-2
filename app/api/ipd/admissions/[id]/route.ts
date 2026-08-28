import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { syncAutoRoomCharge } from '@/lib/ipdCharges';
function nowDateTime() {
    const now = new Date();
    return { date: now.toISOString().slice(0, 10), time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` };
}
const SEL = `
  SELECT a.*,
    p.full_name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender, p.cnic AS patient_cnic, p.address AS patient_address,
    r.room_no, r.room_type, r.price_per_day, r.floor,
    d.name AS doctor_name, d.specialization,
    u.name AS admitted_by_name
  FROM admissions a
  JOIN patients p ON p.id = a.patient_id
  JOIN rooms r ON r.id = a.room_id
  LEFT JOIN doctors d ON d.id = a.doctor_id
  JOIN users u ON u.id = a.admitted_by_user_id
`;
async function getCharges(db: any, id: number) {
    return await db.prepare(`SELECT ac.*, u.name AS added_by_name
     FROM admission_charges ac JOIN users u ON u.id = ac.added_by_user_id
     WHERE ac.admission_id = ? ORDER BY ac.charge_date ASC, ac.created_at ASC`).all(id);
}
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        let admission = await db.prepare(`${SEL} WHERE a.id = ?`).get(id) as any;
        if (!admission)
            return fail('Admission not found.', 404);
        // Keep the auto room-fee charge (days stayed x rate) current every time an admitted
        // patient's file is viewed, so the running bill is always accurate without manual upkeep.
        if (admission.status === 'admitted') {
            const { date, time } = nowDateTime();
            await syncAutoRoomCharge(db, id, date, time, session.id);
            admission = await db.prepare(`${SEL} WHERE a.id = ?`).get(id);
        }
        const charges = await getCharges(db, id);
        return ok({ admission, charges });
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
        await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const b = await req.json();
        const existing = await db.prepare(`SELECT * FROM admissions WHERE id = ?`).get(id) as any;
        if (!existing)
            return fail('Admission not found.', 404);
        const updates: string[] = [];
        const vals: any[] = [];
        if (b.diagnosis !== undefined) {
            updates.push('diagnosis = ?');
            vals.push(b.diagnosis);
        }
        if (b.notes !== undefined) {
            updates.push('notes = ?');
            vals.push(b.notes);
        }
        if (b.doctor_id !== undefined) {
            updates.push('doctor_id = ?');
            vals.push(b.doctor_id);
        }
        if (b.payment_method) {
            updates.push('payment_method = ?');
            vals.push(b.payment_method);
        }
        if (b.discount !== undefined) {
            updates.push('discount = ?');
            vals.push(Number(b.discount));
        }
        if (b.paid_amount !== undefined) {
            const paid = Number(b.paid_amount);
            const discount = b.discount !== undefined ? Number(b.discount) : existing.discount;
            const net = Math.max(existing.grand_total - discount, 0);
            const status = paid >= net && net > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
            updates.push('paid_amount = ?', 'payment_status = ?');
            vals.push(paid, status);
        }
        if (!updates.length)
            return fail('Nothing to update.');
        updates.push("updated_at = now_iso()");
        await db.prepare(`UPDATE admissions SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        const admission = await db.prepare(`${SEL} WHERE a.id = ?`).get(id);
        const charges = await getCharges(db, id);
        return ok({ admission, charges });
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
        await requireRole('super_admin');
        const db = await getDb();
        const id = Number(params.id);
        const adm = await db.prepare(`SELECT * FROM admissions WHERE id = ?`).get(id) as any;
        if (!adm)
            return fail('Admission not found.', 404);
        if (adm.status === 'admitted')
            await db.prepare(`UPDATE rooms SET status = 'available' WHERE id = ?`).run(adm.room_id);
        await db.prepare(`DELETE FROM admissions WHERE id = ?`).run(id);
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
