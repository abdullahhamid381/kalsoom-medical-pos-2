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
        const fields: Record<string, any> = {
            name: b.name, category: b.category, price: b.price !== undefined ? Number(b.price) : undefined,
            turnaround: b.turnaround, description: b.description, default_sample_type: b.default_sample_type,
            turnaround_hours: b.turnaround_hours !== undefined ? (b.turnaround_hours === null || b.turnaround_hours === '' ? null : Number(b.turnaround_hours)) : undefined,
        };
        if (typeof b.is_culture === 'boolean')
            fields.is_culture = b.is_culture ? 1 : 0;
        if (typeof b.active === 'boolean')
            fields.active = b.active ? 1 : 0;
        const updates = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
        const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
        if (!updates.length)
            return fail('Nothing to update.');
        await db.prepare(`UPDATE lab_tests SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
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
        const used = await db.prepare(`SELECT COUNT(*) AS c FROM lab_order_items WHERE test_id = ?`).get(id) as {
            c: number;
        };
        if (used.c > 0) {
            await db.prepare(`UPDATE lab_tests SET active = 0 WHERE id = ?`).run(id);
            return ok({ deactivated: true });
        }
        await db.prepare(`DELETE FROM lab_tests WHERE id = ?`).run(id);
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
