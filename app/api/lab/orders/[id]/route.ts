import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

const STATUSES = ['pending', 'processing', 'completed', 'cancelled'];
const PAY_METHODS = ['cash', 'jazzcash', 'easypaisa', 'bank_transfer', 'card'];
const PRIORITIES = ['routine', 'urgent', 'stat'];
const CLAIM_STATUSES = ['none', 'pending', 'submitted', 'approved', 'rejected'];

function getOrder(db: any, id: number) {
  const order = db.prepare(
    `SELECT lo.*, u.name AS booked_by_name,
            a.appointment_no AS linked_appointment_no,
            ad.admission_no AS linked_admission_no,
            rd.name AS referring_doctor_name, rd.commission_percent AS referring_doctor_commission_percent
     FROM lab_orders lo
     JOIN users u ON u.id = lo.booked_by_user_id
     LEFT JOIN appointments a ON a.id = lo.appointment_id
     LEFT JOIN admissions ad ON ad.id = lo.admission_id
     LEFT JOIN lab_referring_doctors rd ON rd.id = lo.referring_doctor_id
     WHERE lo.id = ?`
  ).get(id) as any;
  if (!order) return null;
  const items = db.prepare(`SELECT * FROM lab_order_items WHERE order_id = ? ORDER BY id`).all(id);
  const panels = db.prepare(`SELECT * FROM lab_order_panels WHERE order_id = ? ORDER BY id`).all(id);
  const samples = db.prepare(`SELECT * FROM lab_samples WHERE order_id = ? ORDER BY id`).all(id) as any[];
  for (const sample of samples) {
    sample.items = items.filter((i: any) => i.sample_id === sample.id);
  }
  const homeCollection = order.collection_mode === 'home'
    ? db.prepare(`SELECT * FROM lab_home_collections WHERE order_id = ?`).get(id)
    : null;
  return { ...order, items, panels, samples, homeCollection };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const db = getDb();
    const order = getOrder(db, Number(params.id));
    if (!order) return fail('Order not found.', 404);
    return ok({ order });
  } catch (err) { return handleApiError(err); }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const db = getDb();
    const id = Number(params.id);
    const b = await req.json();
    const existing = db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id) as any;
    if (!existing) return fail('Order not found.', 404);

    const updates: string[] = [];
    const vals: any[] = [];

    if (STATUSES.includes(b.status)) { updates.push('status = ?'); vals.push(b.status); }
    if (PAY_METHODS.includes(b.payment_method)) { updates.push('payment_method = ?'); vals.push(b.payment_method); }
    if (b.referring_doctor !== undefined) { updates.push('referring_doctor = ?'); vals.push(b.referring_doctor); }
    if (b.notes !== undefined) { updates.push('notes = ?'); vals.push(b.notes); }
    if (PRIORITIES.includes(b.priority)) { updates.push('priority = ?'); vals.push(b.priority); }
    if (b.insurance_provider !== undefined) { updates.push('insurance_provider = ?'); vals.push(b.insurance_provider || null); }
    if (b.tpa_reference !== undefined) { updates.push('tpa_reference = ?'); vals.push(b.tpa_reference || null); }
    if (CLAIM_STATUSES.includes(b.claim_status)) { updates.push('claim_status = ?'); vals.push(b.claim_status); }
    if (b.paid_amount !== undefined) {
      const paid = Number(b.paid_amount);
      const status = paid >= existing.total && existing.total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      updates.push('paid_amount = ?', 'payment_status = ?');
      vals.push(paid, status);
    }
    if (b.discount !== undefined) {
      const discount = Number(b.discount);
      const total = Math.max(existing.subtotal - discount, 0);
      updates.push('discount = ?', 'total = ?');
      vals.push(discount, total);
    }
    if (!updates.length) return fail('Nothing to update.');
    updates.push("updated_at = datetime('now')");
    db.prepare(`UPDATE lab_orders SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
    return ok({ order: getOrder(db, id) });
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const db = getDb();
    db.prepare(`DELETE FROM lab_orders WHERE id = ?`).run(Number(params.id));
    return ok({ deleted: true });
  } catch (err) { return handleApiError(err); }
}
