import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const db = getDb();
    db.prepare(`DELETE FROM lab_test_reagents WHERE id = ?`).run(Number(params.id));
    return ok({ deleted: true });
  } catch (err) { return handleApiError(err); }
}
