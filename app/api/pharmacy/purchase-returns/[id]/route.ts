import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const id = Number(params.id);
        const ret = await db.prepare(`SELECT pr.*, s.name AS supplier_name, u.name AS created_by_name
       FROM purchase_returns pr
       JOIN suppliers s ON s.id = pr.supplier_id
       JOIN users u ON u.id = pr.created_by_user_id
       WHERE pr.id = ?`).get(id) as any;
        if (!ret)
            return fail('Purchase return not found.', 404);
        const items = await db.prepare(`SELECT * FROM purchase_return_items WHERE return_id = ? ORDER BY id`).all(id);
        return ok({ purchaseReturn: { ...ret, items } });
    }
    catch (err) {
        return handleApiError(err);
    }
}
