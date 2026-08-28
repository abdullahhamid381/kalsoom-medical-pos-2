import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const patientId = Number(sp.get('patient_id'));
        const testId = sp.get('test_id') ? Number(sp.get('test_id')) : null;
        if (!patientId)
            return fail('patient_id is required.');
        if (testId) {
            const rows = await db.prepare(`SELECT lr.value_type, lr.value_numeric, lr.value_text, lr.unit, lr.flag, lr.entered_at, lo.order_no, lo.created_at
         FROM lab_results lr
         JOIN lab_orders lo ON lo.id = lr.order_id
         WHERE lo.patient_id = ? AND lr.test_id = ? AND lr.entered_at IS NOT NULL
         ORDER BY lo.created_at DESC LIMIT 20`).all(patientId, testId);
            return ok({ history: rows });
        }
        // No test_id: return every test the patient has ever had results for, grouped.
        const rows = await db.prepare(`SELECT lr.test_id, loi.test_name, lr.value_type, lr.value_numeric, lr.value_text, lr.unit, lr.flag,
              lr.entered_at, lo.order_no, lo.created_at
       FROM lab_results lr
       JOIN lab_orders lo ON lo.id = lr.order_id
       JOIN lab_order_items loi ON loi.id = lr.order_item_id
       WHERE lo.patient_id = ? AND lr.entered_at IS NOT NULL
       ORDER BY lo.created_at DESC`).all(patientId) as any[];
        const byTest = new Map<number, {
            test_id: number;
            test_name: string;
            unit: string | null;
            history: any[];
        }>();
        for (const row of rows) {
            if (!byTest.has(row.test_id))
                byTest.set(row.test_id, { test_id: row.test_id, test_name: row.test_name, unit: row.unit, history: [] });
            byTest.get(row.test_id)!.history.push(row);
        }
        return ok({ tests: Array.from(byTest.values()) });
    }
    catch (err) {
        return handleApiError(err);
    }
}
