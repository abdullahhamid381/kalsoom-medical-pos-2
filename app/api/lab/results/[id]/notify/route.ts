import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const db = getDb();
    const id = Number(params.id);
    const result = db.prepare(`SELECT * FROM lab_results WHERE id = ?`).get(id);
    if (!result) return fail('Result not found.', 404);
    const b = await req.json();
    db.prepare(
      `UPDATE lab_results SET critical_notified_at = datetime('now'), critical_notified_by_user_id = ?, critical_notify_notes = ? WHERE id = ?`
    ).run(session.id, b.notes || null, id);
    return ok({ notified: true });
  } catch (err) { return handleApiError(err); }
}
