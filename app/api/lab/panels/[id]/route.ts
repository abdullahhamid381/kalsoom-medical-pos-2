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
            turnaround: b.turnaround, description: b.description
        };
        if (typeof b.active === 'boolean')
            fields.active = b.active ? 1 : 0;
        const updates = Object.entries(fields).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
        const vals = Object.entries(fields).filter(([, v]) => v !== undefined).map(([, v]) => v);
        if (updates.length)
            await db.prepare(`UPDATE lab_panels SET ${updates.join(', ')} WHERE id = ?`).run(...vals, id);
        if (Array.isArray(b.member_test_ids)) {
            const tx = db.transaction(async () => {
                await db.prepare(`DELETE FROM lab_panel_tests WHERE panel_id = ?`).run(id);
                for (const testId of b.member_test_ids.map(Number)) {
                    await db.prepare(`INSERT INTO lab_panel_tests (panel_id, test_id) VALUES (?, ?) ON CONFLICT (panel_id, test_id) DO NOTHING`).run(id, testId);
                }
            });
            await tx();
        }
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
        const used = await db.prepare(`SELECT COUNT(*) AS c FROM lab_order_panels WHERE panel_id = ?`).get(id) as {
            c: number;
        };
        if (used.c > 0) {
            await db.prepare(`UPDATE lab_panels SET active = 0 WHERE id = ?`).run(id);
            return ok({ deactivated: true });
        }
        await db.prepare(`DELETE FROM lab_panels WHERE id = ?`).run(id);
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
