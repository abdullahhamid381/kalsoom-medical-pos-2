import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const order = await db.prepare(`SELECT lo.*, u.name AS reported_by_name FROM lab_orders lo
       LEFT JOIN users u ON u.id = lo.reported_by_user_id WHERE lo.id = ?`).get(id) as any;
        if (!order)
            return fail('Order not found.', 404);
        const items = await db.prepare(`SELECT loi.id AS order_item_id, loi.test_name, lt.category, lt.is_culture, lop.panel_name,
              lr.value_type, lr.value_numeric, lr.value_text, lr.unit, lr.reference_display, lr.flag, lr.comment
       FROM lab_order_items loi
       JOIN lab_tests lt ON lt.id = loi.test_id
       LEFT JOIN lab_order_panels lop ON lop.id = loi.order_panel_id
       LEFT JOIN lab_results lr ON lr.order_item_id = loi.id
       WHERE loi.order_id = ?
       ORDER BY loi.order_panel_id IS NULL DESC, loi.order_panel_id, loi.id`).all(id) as any[];
        for (const item of items) {
            if (!item.is_culture)
                continue;
            const organisms = await db.prepare(`SELECT co.id, co.growth_count, o.name AS organism_name FROM lab_culture_organisms co
         JOIN lab_organisms o ON o.id = co.organism_id WHERE co.order_item_id = ?`).all(item.order_item_id) as any[];
            item.culture = await Promise.all(organisms.map(async (org) => ({
                organism: org.organism_name,
                growth_count: org.growth_count,
                sensitivities: await db.prepare(`SELECT a.name AS antibiotic, cs.result FROM lab_culture_sensitivities cs
           JOIN lab_antibiotics a ON a.id = cs.antibiotic_id WHERE cs.culture_organism_id = ?`).all(org.id)
            })));
        }
        return ok({ order, items });
    }
    catch (err) {
        return handleApiError(err);
    }
}
