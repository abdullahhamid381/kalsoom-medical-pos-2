import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const result = await db.prepare(`SELECT * FROM lab_results WHERE id = ?`).get(id);
        if (!result)
            return fail('Result not found.', 404);
        const b = await req.json();
        await db.prepare(`UPDATE lab_results SET critical_notified_at = now_iso(), critical_notified_by_user_id = ?, critical_notify_notes = ? WHERE id = ?`).run(session.id, b.notes || null, id);
        return ok({ notified: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
