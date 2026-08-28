import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { resolveReferenceRange, computeFlag, computeTextFlag, formatRangeDisplay } from '@/lib/lab-results';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
// v1 default: any numeric result more than 20% different from the patient's last result
// for the same test is flagged for review. Not yet configurable per-test.
const DELTA_THRESHOLD_PCT = 0.2;
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const order = await db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id) as any;
        if (!order)
            return fail('Order not found.', 404);
        const items = await db.prepare(`SELECT loi.*, lt.category AS test_category, lt.is_culture, lp.panel_name
       FROM lab_order_items loi
       JOIN lab_tests lt ON lt.id = loi.test_id
       LEFT JOIN lab_order_panels lp ON lp.id = loi.order_panel_id
       WHERE loi.order_id = ? ORDER BY loi.order_panel_id IS NULL DESC, loi.order_panel_id, loi.id`).all(id) as any[];
        const rows = await Promise.all(items.map(async (item) => {
            const existing = await db.prepare(`SELECT * FROM lab_results WHERE order_item_id = ?`).get(item.id) as any;
            const range = await resolveReferenceRange(db, item.test_id, order.patient_age, order.patient_gender);
            return {
                order_item_id: item.id,
                test_id: item.test_id,
                test_name: item.test_name,
                category: item.test_category,
                panel_name: item.panel_name || null,
                is_culture: !!item.is_culture,
                reference_display: formatRangeDisplay(range),
                reference_value_type: range?.value_type || 'numeric',
                result: existing || null
            };
        }));
        return ok({ order_status: order.report_status, items: rows });
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
        const session = await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist');
        const db = await getDb();
        const id = Number(params.id);
        const order = await db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id) as any;
        if (!order)
            return fail('Order not found.', 404);
        if (['reviewed', 'reported'].includes(order.report_status)) {
            return fail('Results have moved past entry — send the report back to technician before editing.', 409);
        }
        const b = await req.json();
        const results: any[] = Array.isArray(b.results) ? b.results : [];
        if (results.length === 0)
            return fail('No results provided.');
        // Pre-validate the "reason required" rule before touching the database, so a missing
        // reason returns a clean 400 instead of aborting mid-transaction.
        if (order.reported_at) {
            for (const r of results) {
                const item = await db.prepare(`SELECT * FROM lab_order_items WHERE id = ? AND order_id = ?`).get(Number(r.order_item_id), id) as any;
                if (!item)
                    continue;
                const existing = await db.prepare(`SELECT * FROM lab_results WHERE order_item_id = ?`).get(item.id) as any;
                if (!existing || !existing.entered_at)
                    continue;
                const valueType = r.value_type === 'text' ? 'text' : 'numeric';
                const valueNumeric = valueType === 'numeric' && r.value_numeric !== undefined && r.value_numeric !== '' ? Number(r.value_numeric) : null;
                const valueText = valueType === 'text' ? (r.value_text || null) : null;
                const changed = existing.value_numeric !== valueNumeric || existing.value_text !== valueText;
                if (changed && !String(r.reason || '').trim()) {
                    return fail('A reason is required to amend a previously reported result.');
                }
            }
        }
        const tx = db.transaction(async () => {
            for (const r of results) {
                const item = await db.prepare(`SELECT * FROM lab_order_items WHERE id = ? AND order_id = ?`).get(Number(r.order_item_id), id) as any;
                if (!item)
                    continue;
                const valueType = r.value_type === 'text' ? 'text' : 'numeric';
                const range = await resolveReferenceRange(db, item.test_id, order.patient_age, order.patient_gender);
                const valueNumeric = valueType === 'numeric' && r.value_numeric !== undefined && r.value_numeric !== '' ? Number(r.value_numeric) : null;
                const valueText = valueType === 'text' ? (r.value_text || null) : null;
                const flag = valueType === 'numeric' ? computeFlag(range, valueNumeric) : (r.flag === 'critical' ? 'critical' : computeTextFlag(range, valueText));
                const existing = await db.prepare(`SELECT * FROM lab_results WHERE order_item_id = ?`).get(item.id) as any;
                // Amendment audit trail: log when overwriting an already-entered value with a different one.
                // (The "reason required" rule was already validated before this transaction started.)
                if (existing && existing.entered_at) {
                    const changed = existing.value_numeric !== valueNumeric || existing.value_text !== valueText;
                    if (changed) {
                        await db.prepare(`INSERT INTO lab_result_amendments (result_id, old_value_numeric, old_value_text, new_value_numeric, new_value_text, reason, amended_by_user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`).run(existing.id, existing.value_numeric, existing.value_text, valueNumeric, valueText, r.reason || null, session.id);
                    }
                }
                // Delta check: flag numeric results that swing >20% from the patient's last result for this test.
                let deltaFlag = 0;
                if (valueType === 'numeric' && valueNumeric != null && order.patient_id) {
                    const prev = await db.prepare(`SELECT lr.value_numeric FROM lab_results lr JOIN lab_orders lo ON lo.id = lr.order_id
             WHERE lo.patient_id = ? AND lr.test_id = ? AND lr.entered_at IS NOT NULL AND lo.id != ?
             ORDER BY lo.created_at DESC LIMIT 1`).get(order.patient_id, item.test_id, id) as {
                        value_numeric: number | null;
                    } | undefined;
                    if (prev?.value_numeric != null && prev.value_numeric !== 0) {
                        deltaFlag = Math.abs(valueNumeric - prev.value_numeric) / Math.abs(prev.value_numeric) > DELTA_THRESHOLD_PCT ? 1 : 0;
                    }
                }
                await db.prepare(`INSERT INTO lab_results (order_id, order_item_id, test_id, value_type, value_numeric, value_text, unit,
             reference_range_id, reference_display, flag, comment, entered_by_user_id, entered_at, delta_flag)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now_iso(), ?)
           ON CONFLICT(order_item_id) DO UPDATE SET
             value_type = excluded.value_type, value_numeric = excluded.value_numeric, value_text = excluded.value_text,
             unit = excluded.unit, reference_range_id = excluded.reference_range_id, reference_display = excluded.reference_display,
             flag = excluded.flag, comment = excluded.comment, entered_by_user_id = excluded.entered_by_user_id,
             entered_at = now_iso(), updated_at = now_iso(), delta_flag = excluded.delta_flag`).run(id, item.id, item.test_id, valueType, valueNumeric, valueText, r.unit || range?.unit || null, range?.id || null, formatRangeDisplay(range), flag, r.comment || null, session.id, deltaFlag);
                // Reagent auto-deduction: only once per order item, guarded by lab_order_items.reagent_deducted.
                if (!item.reagent_deducted) {
                    const mappings = await db.prepare(`SELECT * FROM lab_test_reagents WHERE test_id = ?`).all(item.test_id) as any[];
                    for (const m of mappings) {
                        const reagent = await db.prepare(`SELECT * FROM lab_reagents WHERE id = ?`).get(m.reagent_id) as any;
                        if (!reagent)
                            continue;
                        const qtyBefore = reagent.stock_qty;
                        const qtyAfter = qtyBefore - m.qty_per_test;
                        await db.prepare(`UPDATE lab_reagents SET stock_qty = ? WHERE id = ?`).run(qtyAfter, reagent.id);
                        await db.prepare(`INSERT INTO lab_reagent_movements (reagent_id, movement_type, qty_change, qty_before, qty_after, reference_no, created_by_user_id)
               VALUES (?, 'consumption', ?, ?, ?, ?, ?)`).run(reagent.id, -m.qty_per_test, qtyBefore, qtyAfter, String(item.id), session.id);
                    }
                    if (mappings.length > 0) {
                        await db.prepare(`UPDATE lab_order_items SET reagent_deducted = 1 WHERE id = ?`).run(item.id);
                    }
                }
            }
            if (order.report_status === 'pending') {
                await db.prepare(`UPDATE lab_orders SET report_status = 'entered' WHERE id = ?`).run(id);
            }
        });
        await tx();
        return ok({ saved: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
