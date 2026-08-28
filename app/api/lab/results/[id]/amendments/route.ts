import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
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
