import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const db = getDb();
    const id = Number(params.id);
    const b = await req.json();
    const valueType = b.value_type === 'text' ? 'text' : 'numeric';
    db.prepare(
      `UPDATE lab_test_reference_ranges SET
         gender = ?, age_min = ?, age_max = ?, value_type = ?, low = ?, high = ?, unit = ?,
         normal_text = ?, critical_low = ?, critical_high = ?, notes = ?
       WHERE id = ?`
    ).run(
      b.gender || 'any', Number(b.age_min ?? 0), Number(b.age_max ?? 150), valueType,
      valueType === 'numeric' && b.low !== undefined && b.low !== '' ? Number(b.low) : null,
      valueType === 'numeric' && b.high !== undefined && b.high !== '' ? Number(b.high) : null,
      b.unit || null,
      valueType === 'text' ? (b.normal_text || null) : null,
      b.critical_low !== undefined && b.critical_low !== '' ? Number(b.critical_low) : null,
      b.critical_high !== undefined && b.critical_high !== '' ? Number(b.critical_high) : null,
      b.notes || null,
      id
    );
    return ok({ updated: true });
  } catch (err) { return handleApiError(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin');
    const db = getDb();
    db.prepare(`DELETE FROM lab_test_reference_ranges WHERE id = ?`).run(Number(params.id));
    return ok({ deleted: true });
  } catch (err) { return handleApiError(err); }
}
