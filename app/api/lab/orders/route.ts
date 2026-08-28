import { NextRequest } from 'next/server';
import { getDb, nextOrderNo, nextSampleId } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
const ORDER_SELECT = `
  SELECT lo.*, u.name AS booked_by_name
  FROM lab_orders lo JOIN users u ON u.id = lo.booked_by_user_id
`;
const PRIORITIES = ['routine', 'urgent', 'stat'];
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const conds: string[] = [];
        const vals: any[] = [];
        const date = sp.get('date');
        const from = sp.get('from');
        const to = sp.get('to');
        const status = sp.get('status');
        const priority = sp.get('priority');
        const claimStatus = sp.get('claim_status');
        const q = sp.get('q')?.trim();
        if (date) {
            conds.push("LEFT(lo.created_at, 10) = ?");
            vals.push(date);
        }
        if (from) {
            conds.push("LEFT(lo.created_at, 10) >= ?");
            vals.push(from);
        }
        if (to) {
            conds.push("LEFT(lo.created_at, 10) <= ?");
            vals.push(to);
        }
        if (status) {
            conds.push("lo.status = ?");
            vals.push(status);
        }
        if (priority) {
            conds.push("lo.priority = ?");
            vals.push(priority);
        }
        if (claimStatus) {
            conds.push("lo.claim_status = ?");
            vals.push(claimStatus);
        }
        if (q) {
            conds.push("(lo.patient_name LIKE ? OR lo.patient_phone LIKE ? OR lo.order_no LIKE ?)");
            vals.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const orders = await db.prepare(`${ORDER_SELECT} ${where} ORDER BY lo.created_at DESC LIMIT 500`).all(...vals);
        return ok({ orders });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        const session = await requireSession();
        const b = await req.json();
        const tests: any[] = Array.isArray(b.tests) ? b.tests : [];
        const panels: any[] = Array.isArray(b.panels) ? b.panels : [];
        if (tests.length === 0 && panels.length === 0)
            return fail('Select at least one test or panel.');
        const db = await getDb();
        const dateStr = new Date().toISOString().slice(0, 10);
        const order_no = await nextOrderNo(db, dateStr);
        // Resolve patient
        let patient_id: number | null = null;
        let patient_name = String(b.patient_name || '').trim();
        let patient_phone = String(b.patient_phone || '').trim() || null;
        let patient_age = b.patient_age ? Number(b.patient_age) : null;
        let patient_gender = b.patient_gender || null;
        if (b.patient_id) {
            const pat = await db.prepare(`SELECT * FROM patients WHERE id = ?`).get(Number(b.patient_id)) as any;
            if (pat) {
                patient_id = pat.id;
                patient_name = pat.full_name;
                patient_phone = pat.phone;
                patient_age = pat.age;
                patient_gender = pat.gender;
            }
        }
        if (!patient_name)
            return fail('Patient name is required.');
        const priority = PRIORITIES.includes(b.priority) ? b.priority : 'routine';
        const appointment_id = b.appointment_id ? Number(b.appointment_id) : null;
        const admission_id = b.admission_id ? Number(b.admission_id) : null;
        const collection_mode = b.collection_mode === 'home' ? 'home' : 'lab';
        let referring_doctor_id: number | null = null;
        let referring_doctor = String(b.referring_doctor || '').trim() || null;
        if (b.referring_doctor_id) {
            const rd = await db.prepare(`SELECT * FROM lab_referring_doctors WHERE id = ?`).get(Number(b.referring_doctor_id)) as any;
            if (rd) {
                referring_doctor_id = rd.id;
                referring_doctor = rd.name;
            }
        }
        const subtotal = tests.reduce((s: number, t: any) => s + Number(t.price), 0)
            + panels.reduce((s: number, p: any) => s + Number(p.price), 0);
        const discount = Number(b.discount || 0);
        const total = Math.max(subtotal - discount, 0);
        const paid = Number(b.paid_amount || 0);
        const payment_status = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
        const tx = db.transaction(async () => {
            const r = await db.prepare(`INSERT INTO lab_orders (order_no, patient_id, patient_name, patient_phone, patient_age, patient_gender,
           referring_doctor, referring_doctor_id, booked_by_user_id, payment_method, subtotal, discount, total, paid_amount,
           payment_status, status, notes, priority, appointment_id, admission_id, collection_mode,
           insurance_provider, tpa_reference, claim_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`).run(order_no, patient_id, patient_name, patient_phone, patient_age, patient_gender, referring_doctor, referring_doctor_id, session.id, b.payment_method || 'cash', subtotal, discount, total, paid, payment_status, b.notes || null, priority, appointment_id, admission_id, collection_mode, b.insurance_provider || null, b.tpa_reference || null, b.claim_status && b.claim_status !== 'none' ? b.claim_status : 'none');
            const orderId = r.lastInsertRowid as number;
            if (collection_mode === 'home') {
                await db.prepare(`INSERT INTO lab_home_collections (order_id, address, scheduled_at) VALUES (?, ?, ?)`)
                    .run(orderId, b.home_address || null, b.home_scheduled_at || null);
            }
            // Ad-hoc tests
            const insertedItemIds: number[] = [];
            for (const t of tests) {
                const test = await db.prepare(`SELECT * FROM lab_tests WHERE id = ?`).get(Number(t.id)) as any;
                if (!test)
                    continue;
                const ir = await db.prepare(`INSERT INTO lab_order_items (order_id, test_id, test_name, price) VALUES (?, ?, ?, ?)`)
                    .run(orderId, test.id, test.name, Number(t.price));
                insertedItemIds.push(ir.lastInsertRowid as number);
            }
            // Panels: one billing line + member-test rows priced at 0 (cost captured on the panel line)
            for (const p of panels) {
                const panel = await db.prepare(`SELECT * FROM lab_panels WHERE id = ?`).get(Number(p.id)) as any;
                if (!panel)
                    continue;
                const pr = await db.prepare(`INSERT INTO lab_order_panels (order_id, panel_id, panel_name, price) VALUES (?, ?, ?, ?)`)
                    .run(orderId, panel.id, panel.name, Number(p.price ?? panel.price));
                const orderPanelId = pr.lastInsertRowid as number;
                const memberTests = await db.prepare(`SELECT lt.* FROM lab_panel_tests lpt JOIN lab_tests lt ON lt.id = lpt.test_id WHERE lpt.panel_id = ?`).all(panel.id) as any[];
                for (const test of memberTests) {
                    const ir = await db.prepare(`INSERT INTO lab_order_items (order_id, test_id, test_name, price, order_panel_id) VALUES (?, ?, ?, 0, ?)`).run(orderId, test.id, test.name, orderPanelId);
                    insertedItemIds.push(ir.lastInsertRowid as number);
                }
            }
            // Auto-create samples grouped by each test's default sample type
            const items = await db.prepare(`SELECT loi.id, lt.default_sample_type FROM lab_order_items loi JOIN lab_tests lt ON lt.id = loi.test_id WHERE loi.order_id = ?`).all(orderId) as {
                id: number;
                default_sample_type: string;
            }[];
            const bySampleType = new Map<string, number[]>();
            for (const item of items) {
                const type = item.default_sample_type || 'blood';
                if (!bySampleType.has(type))
                    bySampleType.set(type, []);
                bySampleType.get(type)!.push(item.id);
            }
            for (const [sampleType, itemIds] of bySampleType) {
                const sampleId = await nextSampleId(db, dateStr);
                const sr = await db.prepare(`INSERT INTO lab_samples (sample_id, order_id, sample_type) VALUES (?, ?, ?)`)
                    .run(sampleId, orderId, sampleType);
                const newSampleRowId = sr.lastInsertRowid as number;
                for (const itemId of itemIds) {
                    await db.prepare(`UPDATE lab_order_items SET sample_id = ? WHERE id = ?`).run(newSampleRowId, itemId);
                }
            }
            return orderId;
        });
        const orderId = await tx();
        const order = await db.prepare(`${ORDER_SELECT} WHERE lo.id = ?`).get(orderId) as any;
        return ok({ order }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
