import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist', 'lab_pathologist');
    const db = getDb();
    const orderItemId = Number(req.nextUrl.searchParams.get('order_item_id'));
    if (!orderItemId) return fail('order_item_id is required.');
    const organisms = db.prepare(
      `SELECT co.*, o.name AS organism_name FROM lab_culture_organisms co JOIN lab_organisms o ON o.id = co.organism_id WHERE co.order_item_id = ?`
    ).all(orderItemId) as any[];
    for (const org of organisms) {
      org.sensitivities = db.prepare(
        `SELECT cs.*, a.name AS antibiotic_name FROM lab_culture_sensitivities cs JOIN lab_antibiotics a ON a.id = cs.antibiotic_id WHERE cs.culture_organism_id = ?`
      ).all(org.id);
    }
    return ok({ organisms });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
    const db = getDb();
    const id = Number(params.id);
    const order = db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id) as any;
    if (!order) return fail('Order not found.', 404);
    if (['reviewed', 'reported'].includes(order.report_status)) {
      return fail('Results have moved past entry — send the report back to technician before editing.', 409);
    }

    const b = await req.json();
    const orderItemId = Number(b.order_item_id);
    const item = db.prepare(`SELECT * FROM lab_order_items WHERE id = ? AND order_id = ?`).get(orderItemId, id) as any;
    if (!item) return fail('Order item not found on this order.', 404);
    const organisms: any[] = Array.isArray(b.organisms) ? b.organisms : [];

    const tx = db.transaction(() => {
      // Replace this item's culture data wholesale on each save — simplest correct model for
      // "what grew" per report, rather than trying to diff/merge organism lists.
      db.prepare(`DELETE FROM lab_culture_organisms WHERE order_item_id = ?`).run(orderItemId);
      for (const org of organisms) {
        const organismId = Number(org.organism_id);
        if (!organismId) continue;
        const r = db.prepare(
          `INSERT INTO lab_culture_organisms (order_item_id, organism_id, growth_count) VALUES (?, ?, ?)`
        ).run(orderItemId, organismId, org.growth_count || null);
        const cultureOrganismId = r.lastInsertRowid as number;
        for (const s of Array.isArray(org.sensitivities) ? org.sensitivities : []) {
          if (!s.antibiotic_id || !['S', 'I', 'R'].includes(s.result)) continue;
          db.prepare(
            `INSERT INTO lab_culture_sensitivities (culture_organism_id, antibiotic_id, result) VALUES (?, ?, ?)`
          ).run(cultureOrganismId, Number(s.antibiotic_id), s.result);
        }
      }

      // Stub lab_results row so the standard "every item has a result" finalize/review gate keeps working.
      const summary = organisms.length === 0 ? 'No growth' : 'See culture report';
      db.prepare(
        `INSERT INTO lab_results (order_id, order_item_id, test_id, value_type, value_text, entered_by_user_id, entered_at)
         VALUES (?, ?, ?, 'text', ?, ?, datetime('now'))
         ON CONFLICT(order_item_id) DO UPDATE SET value_text = excluded.value_text, entered_by_user_id = excluded.entered_by_user_id, entered_at = datetime('now'), updated_at = datetime('now')`
      ).run(id, orderItemId, item.test_id, summary, session.id);

      if (order.report_status === 'pending') {
        db.prepare(`UPDATE lab_orders SET report_status = 'entered' WHERE id = ?`).run(id);
      }
    });
    tx();

    return ok({ saved: true });
  } catch (err) { return handleApiError(err); }
}
