import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole('super_admin');
    const db = getDb();
    const id = Number(params.id);
    const b = await req.json();

    const existing = db.prepare(`SELECT * FROM stock_movements WHERE id = ?`).get(id) as any;
    if (!existing) return fail('Movement record not found.', 404);

    // Only allow editing notes and reference_no — qty changes are immutable audit records
    const updates: string[] = [];
    const vals: any[] = [];
    if (b.notes !== undefined) { updates.push('notes = ?'); vals.push(b.notes); }
    if (b.reference_no !== undefined) { updates.push('reference_no = ?'); vals.push(b.reference_no); }
    if (!updates.length) return fail('Only notes and reference number can be edited on existing movements.');

    db.prepare(`UPDATE stock_movements SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
    return ok({ updated: true });
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const db = getDb();
    const id = Number(params.id);
    const mv = db.prepare(`SELECT * FROM stock_movements WHERE id = ?`).get(id) as any;
    if (!mv) return fail('Movement record not found.', 404);
    if (mv.movement_type === 'sale') return fail('Sale-generated movements cannot be deleted. Delete the sale instead.');

    // Reverse the stock effect before removing the record
    const field = mv.location === 'store' ? 'stock_qty_store' : 'stock_qty';
    const tx = db.transaction(() => {
      db.prepare(`UPDATE medicines SET ${field} = ${field} - ? WHERE id = ?`).run(mv.qty_change, mv.medicine_id);
      db.prepare(`DELETE FROM stock_movements WHERE id = ?`).run(id);
    });
    tx();
    return ok({ deleted: true, note: `Stock reversed by ${mv.qty_change} ${mv.location === 'store' ? '(store)' : '(pharmacy)'}` });
  } catch (err) { return handleApiError(err); }
}
