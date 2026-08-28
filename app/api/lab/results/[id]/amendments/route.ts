import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const amendments = await db.prepare(`SELECT la.*, u.name AS amended_by_name FROM lab_result_amendments la
       JOIN users u ON u.id = la.amended_by_user_id
       WHERE la.result_id = ? ORDER BY la.amended_at DESC`).all(Number(params.id));
        return ok({ amendments });
    }
    catch (err) {
        return handleApiError(err);
    }
}
