import { NextRequest } from 'next/server';
import { getDb, nextSurgeryNo } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
const SEL = `
  SELECT sr.*, p.full_name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender,
    st.name AS surgery_name, st.category AS surgery_category,
    d.name AS surgeon_name, d.specialization AS surgeon_specialization,
    u.name AS booked_by_name
  FROM surgery_records sr
  JOIN patients p ON p.id = sr.patient_id
  JOIN surgery_types st ON st.id = sr.surgery_type_id
  LEFT JOIN doctors d ON d.id = sr.surgeon_id
  JOIN users u ON u.id = sr.booked_by_user_id
`;
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const conds: string[] = [];
        const vals: any[] = [];
        if (sp.get('patient_id')) {
            conds.push('sr.patient_id = ?');
            vals.push(Number(sp.get('patient_id')));
        }
        if (sp.get('status')) {
            conds.push('sr.status = ?');
            vals.push(sp.get('status'));
        }
        if (sp.get('from')) {
            conds.push('sr.surgery_date >= ?');
            vals.push(sp.get('from'));
        }
        if (sp.get('to')) {
            conds.push('sr.surgery_date <= ?');
            vals.push(sp.get('to'));
        }
        if (sp.get('q')) {
            conds.push('(p.full_name LIKE ? OR p.phone LIKE ? OR sr.surgery_no LIKE ?)');
            const q = `%${sp.get('q')}%`;
            vals.push(q, q, q);
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const records = await db.prepare(`${SEL} ${where} ORDER BY sr.surgery_date DESC LIMIT 500`).all(...vals);
        return ok({ records });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        const session = await requireSession();
        const b = await req.json();
        if (!b.patient_id)
            return fail('Select a patient.');
        if (!b.surgery_type_id)
            return fail('Select a surgery type.');
        const db = await getDb();
        const stype = await db.prepare(`SELECT * FROM surgery_types WHERE id = ?`).get(Number(b.surgery_type_id)) as any;
        if (!stype)
            return fail('Surgery type not found.');
        const dateStr = b.surgery_date || new Date().toISOString().slice(0, 10);
        const surgery_no = await nextSurgeryNo(db, dateStr);
        const sf = Number(b.surgery_fee ?? stype.base_price);
        const af = Number(b.anesthesia_fee || 0);
        const tf = Number(b.theatre_fee || 0);
        const mc = Number(b.medicine_cost || 0);
        const oc = Number(b.other_charges || 0);
        const total_cost = sf + af + tf + mc + oc;
        const discount = Number(b.discount || 0);
        const paid = Number(b.paid_amount || 0);
        const net = Math.max(total_cost - discount, 0);
        const ps = paid >= net && net > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
        const r = await db.prepare(`
      INSERT INTO surgery_records
        (surgery_no,patient_id,admission_id,surgery_type_id,surgeon_id,anesthetist,
         surgery_date,surgery_time,duration_hrs,theatre_no,diagnosis,procedure_notes,
         surgery_fee,anesthesia_fee,theatre_fee,medicine_cost,other_charges,total_cost,
         discount,paid_amount,payment_status,payment_method,status,outcome,booked_by_user_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(surgery_no, b.patient_id, b.admission_id || null, b.surgery_type_id, b.surgeon_id || null, b.anesthetist || null, dateStr, b.surgery_time || null, Number(b.duration_hrs || stype.duration_hrs || 1), b.theatre_no || null, b.diagnosis || null, b.procedure_notes || null, sf, af, tf, mc, oc, total_cost, discount, paid, ps, b.payment_method || 'cash', b.status || 'scheduled', b.outcome || null, session.id);
        const record = await db.prepare(`${SEL} WHERE sr.id = ?`).get(r.lastInsertRowid);
        return ok({ record }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
