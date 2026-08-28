import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(_req: NextRequest) {
    try {
        await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist', 'lab_pathologist');
        const db = await getDb();
        const rows = await db.prepare(`
      SELECT loi.id AS order_item_id, loi.order_id, lo.order_no, lo.patient_name, lo.priority, lo.created_at,
             lt.category, loi.test_name, loi.assigned_technician_id, u.name AS assigned_technician_name
      FROM lab_order_items loi
      JOIN lab_orders lo ON lo.id = loi.order_id
      JOIN lab_tests lt ON lt.id = loi.test_id
      LEFT JOIN users u ON u.id = loi.assigned_technician_id
      LEFT JOIN lab_results lr ON lr.order_item_id = loi.id
      WHERE lr.id IS NULL AND lo.status != 'cancelled'
      ORDER BY (lo.priority = 'stat') DESC, (lo.priority = 'urgent') DESC, lo.created_at ASC
    `).all() as any[];
        const groups = new Map<string, any[]>();
        for (const row of rows) {
            const category = row.category || 'General';
            if (!groups.has(category))
                groups.set(category, []);
            groups.get(category)!.push(row);
        }
        return ok({ groups: Array.from(groups.entries()).map(([category, items]) => ({ category, items })) });
    }
    catch (err) {
        return handleApiError(err);
    }
}
