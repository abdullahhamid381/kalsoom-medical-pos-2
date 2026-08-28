import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function PUT(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const b = await req.json();
        const id = Number(params.id);
        const supplier = await db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id) as any;
        if (!supplier)
            return fail('Supplier not found.', 404);
        const fields: Record<string, any> = {
            name: b.name, contact_person: b.contact_person, phone: b.phone,
            email: b.email, address: b.address, notes: b.notes,
        };
        if (typeof b.active === 'boolean')
            fields.active = b.active ? 1 : 0;
        const updates = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
        const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
        if (!updates.length)
            return fail('Nothing to update.');
        await db.prepare(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        return ok({ updated: true, supplier: await db.prepare(`SELECT * FROM suppliers WHERE id = ?`).get(id) });
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
        const used = await db.prepare(`SELECT COUNT(*) AS c FROM purchase_orders WHERE supplier_id = ?`).get(id) as {
            c: number;
        };
        if (used.c > 0) {
            await db.prepare(`UPDATE suppliers SET active = 0 WHERE id = ?`).run(id);
            return ok({ deactivated: true });
        }
        await db.prepare(`DELETE FROM suppliers WHERE id = ?`).run(id);
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
