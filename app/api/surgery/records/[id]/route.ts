import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
const SEL = `
  SELECT sr.*, p.full_name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender, p.cnic AS patient_cnic,
    st.name AS surgery_name, st.category AS surgery_category,
    d.name AS surgeon_name, d.specialization AS surgeon_specialization,
    u.name AS booked_by_name
  FROM surgery_records sr
  JOIN patients p ON p.id = sr.patient_id
  JOIN surgery_types st ON st.id = sr.surgery_type_id
  LEFT JOIN doctors d ON d.id = sr.surgeon_id
  JOIN users u ON u.id = sr.booked_by_user_id
`;
function recalc(b: any, existing: any) {
    const sf = b.surgery_fee !== undefined ? Number(b.surgery_fee) : existing.surgery_fee;
    const af = b.anesthesia_fee !== undefined ? Number(b.anesthesia_fee) : existing.anesthesia_fee;
    const tf = b.theatre_fee !== undefined ? Number(b.theatre_fee) : existing.theatre_fee;
    const mc = b.medicine_cost !== undefined ? Number(b.medicine_cost) : existing.medicine_cost;
    const oc = b.other_charges !== undefined ? Number(b.other_charges) : existing.other_charges;
    const total = sf + af + tf + mc + oc;
    const disc = b.discount !== undefined ? Number(b.discount) : existing.discount;
    const paid = b.paid_amount !== undefined ? Number(b.paid_amount) : existing.paid_amount;
    const net = Math.max(total - disc, 0);
    const ps = paid >= net && net > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
    return { total_cost: total, payment_status: ps };
}
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const rec = await db.prepare(`${SEL} WHERE sr.id = ?`).get(Number(params.id));
        if (!rec)
            return fail('Record not found.', 404);
        return ok({ record: rec });
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
        const existing = await db.prepare(`SELECT * FROM surgery_records WHERE id = ?`).get(id) as any;
        if (!existing)
            return fail('Record not found.', 404);
        const updates: string[] = [];
        const vals: any[] = [];
        const fields: Record<string, any> = {
            surgery_date: b.surgery_date, surgery_time: b.surgery_time, theatre_no: b.theatre_no,
            diagnosis: b.diagnosis, procedure_notes: b.procedure_notes, anesthetist: b.anesthetist,
            duration_hrs: b.duration_hrs !== undefined ? Number(b.duration_hrs) : undefined,
            status: b.status, outcome: b.outcome, surgeon_id: b.surgeon_id, payment_method: b.payment_method,
            surgery_fee: b.surgery_fee !== undefined ? Number(b.surgery_fee) : undefined,
            anesthesia_fee: b.anesthesia_fee !== undefined ? Number(b.anesthesia_fee) : undefined,
            theatre_fee: b.theatre_fee !== undefined ? Number(b.theatre_fee) : undefined,
            medicine_cost: b.medicine_cost !== undefined ? Number(b.medicine_cost) : undefined,
            other_charges: b.other_charges !== undefined ? Number(b.other_charges) : undefined,
            discount: b.discount !== undefined ? Number(b.discount) : undefined,
            paid_amount: b.paid_amount !== undefined ? Number(b.paid_amount) : undefined,
        };
        Object.entries(fields).filter(([, v]) => v !== undefined).forEach(([k, v]) => { updates.push(`${k} = ?`); vals.push(v); });
        if (!updates.length)
            return fail('Nothing to update.');
        const { total_cost, payment_status } = recalc(b, existing);
        updates.push('total_cost = ?', 'payment_status = ?', "updated_at = now_iso()");
        vals.push(total_cost, payment_status);
        await db.prepare(`UPDATE surgery_records SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        return ok({ record: await db.prepare(`${SEL} WHERE sr.id = ?`).get(id) });
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
        await db.prepare(`DELETE FROM surgery_records WHERE id = ?`).run(Number(params.id));
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
