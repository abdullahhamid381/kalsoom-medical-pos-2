import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { recalcTotals } from '@/lib/ipdCharges';

const TYPES = ['room','medicine','lab','procedure','doctor_fee','nursing','other'];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const db = getDb();
    const charges = db.prepare(
      `SELECT ac.*, u.name AS added_by_name FROM admission_charges ac
       JOIN users u ON u.id = ac.added_by_user_id
       WHERE ac.admission_id = ? ORDER BY ac.charge_date ASC, ac.created_at ASC`
    ).all(Number(params.id));
    return ok({ charges });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const db = getDb();
    const admissionId = Number(params.id);
    const adm = db.prepare(`SELECT * FROM admissions WHERE id = ?`).get(admissionId) as any;
    if (!adm) return fail('Admission not found.', 404);

    const b = await req.json();
    if (!TYPES.includes(b.charge_type)) return fail('Invalid charge type.');
    if (!b.description?.trim()) return fail('Description is required.');

    const qty = Number(b.quantity || 1);
    const unit_price = Number(b.unit_price || 0);
    const total = qty * unit_price;

    db.prepare(`
      INSERT INTO admission_charges
        (admission_id, charge_type, description, quantity, unit_price, total, charge_date, ref_sale_id, ref_order_id, added_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      admissionId, b.charge_type, b.description.trim(),
      qty, unit_price, total,
      b.charge_date || new Date().toISOString().slice(0,10),
      b.ref_sale_id || null, b.ref_order_id || null, session.id
    );

    // Recalculate admission totals
    recalcTotals(db, admissionId);
    return ok({ added: true, total });
  } catch (err) { return handleApiError(err); }
}
