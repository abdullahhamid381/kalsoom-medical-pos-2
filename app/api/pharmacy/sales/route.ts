import { NextRequest } from 'next/server';
import { getDb, nextSaleNo } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

const SALE_SELECT = `
  SELECT ps.*, u.name AS sold_by_name
  FROM pharmacy_sales ps
  JOIN users u ON u.id = ps.sold_by_user_id
`;

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const db = getDb();
    const sp = req.nextUrl.searchParams;
    const conds: string[] = [];
    const vals: any[] = [];
    const from = sp.get('from');
    const to = sp.get('to');
    const date = sp.get('date');
    const q = sp.get('q')?.trim();
    if (date) { conds.push("date(ps.created_at) = ?"); vals.push(date); }
    if (from) { conds.push("date(ps.created_at) >= ?"); vals.push(from); }
    if (to)   { conds.push("date(ps.created_at) <= ?"); vals.push(to); }
    if (q) {
      conds.push("(ps.patient_name LIKE ? OR ps.patient_phone LIKE ? OR ps.sale_no LIKE ?)");
      vals.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const sales = db.prepare(`${SALE_SELECT} ${where} ORDER BY ps.created_at DESC LIMIT 500`).all(...vals);
    return ok({ sales });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const b = await req.json();

    if (!Array.isArray(b.items) || b.items.length === 0)
      return fail('Add at least one medicine to the sale.');

    const db = getDb();
    const dateStr = new Date().toISOString().slice(0, 10);
    const sale_no = nextSaleNo(db, dateStr);

    // Validate every medicine exists and has stock (and, if a batch was picked, that batch has enough qty)
    for (const item of b.items) {
      const med = db.prepare(`SELECT * FROM medicines WHERE id = ? AND active = 1`).get(Number(item.medicine_id)) as any;
      if (!med) return fail(`Medicine ID ${item.medicine_id} not found or inactive.`);
      if (med.stock_qty < Number(item.qty))
        return fail(`Insufficient stock for ${med.name} (available: ${med.stock_qty} ${med.unit}).`);
      if (item.batch_id) {
        const batch = db.prepare(`SELECT * FROM medicine_batches WHERE id = ? AND active = 1`).get(Number(item.batch_id)) as any;
        if (!batch) return fail(`Batch not found for ${med.name}.`);
        if (batch.qty < Number(item.qty))
          return fail(`Insufficient batch stock for ${med.name} (batch ${batch.batch_no} has ${batch.qty} ${med.unit}).`);
      }
    }

    const subtotal = b.items.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price), 0);
    const discount = Number(b.discount || 0);
    const total = Math.max(subtotal - discount, 0);

    // Resolve patient info
    let patient_id: number | null = null;
    let patient_name = String(b.patient_name || '').trim() || 'Walk-in Customer';
    let patient_phone = String(b.patient_phone || '').trim() || null;
    if (b.patient_id) {
      const pat = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(Number(b.patient_id)) as any;
      if (pat) { patient_id = pat.id; patient_name = pat.full_name; patient_phone = pat.phone; }
    }

    // Optionally redeem store credit (from a prior return) against this sale
    const redeemAmount = Number(b.redeem_credit_amount || 0);
    if (redeemAmount > 0) {
      if (!patient_phone) return fail('A phone number is required to redeem store credit.');
      const balanceRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS balance FROM customer_credits WHERE phone = ?`).get(patient_phone) as { balance: number };
      if (redeemAmount > balanceRow.balance) return fail(`Insufficient store credit — available: Rs. ${balanceRow.balance.toFixed(0)}.`);
    }

    const paid = Number(b.paid_amount || 0) + redeemAmount;
    const payment_status = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

    const tx = db.transaction(() => {
      const saleResult = db.prepare(
        `INSERT INTO pharmacy_sales
           (sale_no, patient_id, patient_name, patient_phone, sold_by_user_id,
            payment_method, subtotal, discount, total, paid_amount, payment_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        sale_no, patient_id, patient_name, patient_phone, session.id,
        b.payment_method || 'cash', subtotal, discount, total, paid, payment_status,
        b.notes || null
      );
      const saleId = saleResult.lastInsertRowid as number;

      for (const item of b.items) {
        const med = db.prepare(`SELECT * FROM medicines WHERE id = ?`).get(Number(item.medicine_id)) as any;
        const batchId = item.batch_id ? Number(item.batch_id) : null;
        const lineTotal = Number(item.qty) * Number(item.unit_price);
        db.prepare(
          `INSERT INTO pharmacy_sale_items (sale_id, medicine_id, medicine_name, unit, qty, unit_price, total, batch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(saleId, med.id, med.name, med.unit, Number(item.qty), Number(item.unit_price), lineTotal, batchId);
        // Deduct from pharmacy stock and log the movement
        const qty_before = med.stock_qty;
        const qty_after  = qty_before - Number(item.qty);
        db.prepare(`UPDATE medicines SET stock_qty = stock_qty - ? WHERE id = ?`).run(Number(item.qty), med.id);
        db.prepare(
          `INSERT INTO stock_movements (medicine_id, medicine_name, movement_type, location, qty_change, qty_before, qty_after, reference_no, notes, batch_id, created_by_user_id)
           VALUES (?, ?, 'sale', 'pharmacy', ?, ?, ?, ?, 'Sold via pharmacy POS', ?, ?)`
        ).run(med.id, med.name, -Number(item.qty), qty_before, qty_after, sale_no, batchId, session.id);
        // Also deduct from the specific batch, if one was picked
        if (batchId) {
          db.prepare(`UPDATE medicine_batches SET qty = qty - ? WHERE id = ?`).run(Number(item.qty), batchId);
        }
      }

      if (redeemAmount > 0) {
        db.prepare(
          `INSERT INTO customer_credits (phone, customer_name, amount, source, redeemed_sale_id, created_by_user_id)
           VALUES (?, ?, ?, 'redeemed', ?, ?)`
        ).run(patient_phone, patient_name, -redeemAmount, saleId, session.id);
      }

      return saleId;
    });

    const saleId = tx();
    const sale = db.prepare(`${SALE_SELECT} WHERE ps.id = ?`).get(saleId) as any;
    return ok({ sale }, 201);
  } catch (err) { return handleApiError(err); }
}
