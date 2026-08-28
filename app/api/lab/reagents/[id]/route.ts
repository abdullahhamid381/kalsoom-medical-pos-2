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
        const id = Number(params.id);
        const b = await req.json();
        const fields: Record<string, any> = {
            name: b.name, unit: b.unit,
            low_stock_at: b.low_stock_at !== undefined ? Number(b.low_stock_at) : undefined
        };
        if (typeof b.active === 'boolean')
            fields.active = b.active ? 1 : 0;
        const updates = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
        const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
        if (!updates.length)
            return fail('Nothing to update.');
        await db.prepare(`UPDATE lab_reagents SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
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
        await db.prepare(`UPDATE lab_reagents SET active = 0 WHERE id = ?`).run(Number(params.id));
        return ok({ deactivated: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
