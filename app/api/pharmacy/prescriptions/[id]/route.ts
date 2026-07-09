import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb, getUploadsDir } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin', 'pharmacy_admin');
    const db = getDb();
    const id = Number(params.id);
    const p = db.prepare(`SELECT * FROM prescriptions WHERE id = ?`).get(id) as any;
    if (!p) return fail('Prescription not found.', 404);

    try { fs.unlinkSync(path.join(getUploadsDir('prescriptions'), p.file_path)); } catch { /* best-effort */ }
    db.prepare(`DELETE FROM prescriptions WHERE id = ?`).run(id);

    return ok({ deleted: true });
  } catch (err) { return handleApiError(err); }
}
