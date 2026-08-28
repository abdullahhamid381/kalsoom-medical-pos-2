import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
async function getPo(db: any, id: number) {
    const po = await db.prepare(`SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone, u.name AS created_by_name
     FROM purchase_orders po
     JOIN suppliers s ON s.id = po.supplier_id
     JOIN users u ON u.id = po.created_by_user_id
     WHERE po.id = ?`).get(id);
    if (!po)
        return null;
    const items = await db.prepare(`SELECT * FROM purchase_order_items WHERE po_id = ? ORDER BY id`).all(id);
    return { ...po, items };
}
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const po = await getPo(db, Number(params.id));
        if (!po)
            return fail('Purchase order not found.', 404);
        return ok({ purchaseOrder: po });
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
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const id = Number(params.id);
        const existing = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(id) as any;
        if (!existing)
            return fail('Purchase order not found.', 404);
        if (existing.status !== 'draft')
            return fail('Only draft purchase orders can be edited.');
        const b = await req.json();
        const fields: Record<string, any> = {
            expected_date: b.expected_date, notes: b.notes,
        };
        if (b.status === 'ordered' || b.status === 'cancelled')
            fields.status = b.status;
        const updates = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
        const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
        if (!updates.length)
            return fail('Nothing to update.');
        updates.push('updated_at = now_iso()');
        await db.prepare(`UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        return ok({ purchaseOrder: await getPo(db, id) });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function DELETE(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const id = Number(params.id);
        const existing = await db.prepare(`SELECT * FROM purchase_orders WHERE id = ?`).get(id) as any;
        if (!existing)
            return fail('Purchase order not found.', 404);
        if (existing.status !== 'draft')
            return fail('Only draft purchase orders (nothing received yet) can be deleted.');
        await db.prepare(`DELETE FROM purchase_orders WHERE id = ?`).run(id);
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
