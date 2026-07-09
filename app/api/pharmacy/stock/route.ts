import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

const MOVEMENT_TYPES = ['purchase','adjustment','transfer_in','transfer_out','opening'];

export async function GET(req: NextRequest) {
  try {
    await requireRole('super_admin', 'pharmacy_admin');
    const db = getDb();
    const sp = req.nextUrl.searchParams;
    const conds: string[] = [];
    const vals: any[] = [];

    const from = sp.get('from');
    const to   = sp.get('to');
    const medicineId = sp.get('medicine_id');
    const location   = sp.get('location');
    const mtype      = sp.get('movement_type');
    const userId     = sp.get('user_id');

    if (from) { conds.push("date(sm.created_at) >= ?"); vals.push(from); }
    if (to)   { conds.push("date(sm.created_at) <= ?"); vals.push(to); }
    if (medicineId) { conds.push("sm.medicine_id = ?"); vals.push(Number(medicineId)); }
    if (location)   { conds.push("sm.location = ?"); vals.push(location); }
    if (mtype)      { conds.push("sm.movement_type = ?"); vals.push(mtype); }
    if (userId)     { conds.push("sm.created_by_user_id = ?"); vals.push(Number(userId)); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const movements = db.prepare(
      `SELECT sm.*, u.name AS updated_by_name
       FROM stock_movements sm
       JOIN users u ON u.id = sm.created_by_user_id
       ${where}
       ORDER BY sm.created_at DESC LIMIT 1000`
    ).all(...vals);

    return ok({ movements });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole('super_admin', 'pharmacy_admin');
    const b = await req.json();
    const db = getDb();

    const medicine_id = Number(b.medicine_id);
    const med = db.prepare(`SELECT * FROM medicines WHERE id = ? AND active = 1`).get(medicine_id) as any;
    if (!med) return fail('Medicine not found or inactive.');

    const qty_change = Number(b.qty_change);
    if (qty_change === 0) return fail('Quantity change cannot be zero.');

    const movement_type = MOVEMENT_TYPES.includes(b.movement_type) ? b.movement_type : 'purchase';
    const location = b.location === 'store' ? 'store' : 'pharmacy';

    // Determine before/after based on which location is being updated
    const qty_before = location === 'store' ? med.stock_qty_store : med.stock_qty;
    const qty_after  = Math.max(qty_before + qty_change, 0);

    // Update the stock field
    const field = location === 'store' ? 'stock_qty_store' : 'stock_qty';
    if (qty_before + qty_change < 0) return fail(`Not enough stock. Available: ${qty_before} ${med.unit}.`);

    const tx = db.transaction(() => {
      db.prepare(`UPDATE medicines SET ${field} = ? WHERE id = ?`).run(qty_after, medicine_id);
      db.prepare(
        `INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, reference_no, notes, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(medicine_id, med.name, movement_type, location, qty_change, qty_before, qty_after, b.reference_no||null, b.notes||null, session.id);
    });
    tx();

    return ok({ added: true, medicine: db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(medicine_id) }, 201);
  } catch (err) { return handleApiError(err); }
}
