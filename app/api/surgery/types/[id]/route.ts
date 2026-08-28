import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function PUT(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin');
        const db = await getDb();
        const b = await req.json();
        const id = Number(params.id);
        const fields: any = { name: b.name, category: b.category, description: b.description,
            base_price: b.base_price !== undefined ? Number(b.base_price) : undefined,
            duration_hrs: b.duration_hrs !== undefined ? Number(b.duration_hrs) : undefined };
        if (typeof b.active === 'boolean')
            fields.active = b.active ? 1 : 0;
        const updates = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
        const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
        if (!updates.length)
            return fail('Nothing to update.');
        await db.prepare(`UPDATE surgery_types SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        return ok({ updated: true });
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
        await requireRole('super_admin');
        const db = await getDb();
        const id = Number(params.id);
        const used = await db.prepare(`SELECT COUNT(*) AS c FROM surgery_records WHERE surgery_type_id = ?`).get(id) as {
            c: number;
        };
        if (used.c > 0) {
            await db.prepare(`UPDATE surgery_types SET active = 0 WHERE id = ?`).run(id);
            return ok({ deactivated: true });
        }
        await db.prepare(`DELETE FROM surgery_types WHERE id = ?`).run(id);
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
