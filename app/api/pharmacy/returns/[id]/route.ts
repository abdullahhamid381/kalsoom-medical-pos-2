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
        const ret = await db.prepare(`SELECT psr.*, ps.sale_no, ps.patient_name, ps.patient_phone, u.name AS created_by_name
       FROM pharmacy_sale_returns psr
       JOIN pharmacy_sales ps ON ps.id = psr.sale_id
       JOIN users u ON u.id = psr.created_by_user_id
       WHERE psr.id = ?`).get(id) as any;
        if (!ret)
            return fail('Return not found.', 404);
        const items = await db.prepare(`SELECT * FROM pharmacy_sale_return_items WHERE return_id = ? ORDER BY id`).all(id);
        return ok({ return: { ...ret, items } });
    }
    catch (err) {
        return handleApiError(err);
    }
}
