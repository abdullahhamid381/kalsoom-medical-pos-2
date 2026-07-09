import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole('super_admin', 'pharmacy_admin');
    const db = getDb();
    const id = Number(params.id);
    const supplier = db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id) as any;
    if (!supplier) return fail('Supplier not found.', 404);

    const b = await req.json();
    const amount = Number(b.amount || 0);
    if (amount <= 0) return fail('Payment amount must be greater than zero.');

    const result = db.prepare(
      `INSERT INTO supplier_payments (supplier_id, amount, payment_method, reference_no, notes, paid_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, amount, b.payment_method || 'cash', b.reference_no || null, b.notes || null, session.id);

    return ok({ id: result.lastInsertRowid }, 201);
  } catch (err) { return handleApiError(err); }
}
