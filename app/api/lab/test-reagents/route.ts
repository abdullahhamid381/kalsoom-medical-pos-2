import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const db = getDb();
    const testId = req.nextUrl.searchParams.get('test_id');
    const conds: string[] = [];
    const vals: any[] = [];
    if (testId) { conds.push('tr.test_id = ?'); vals.push(Number(testId)); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const mappings = db.prepare(`
      SELECT tr.*, r.name AS reagent_name, r.unit AS reagent_unit
      FROM lab_test_reagents tr JOIN lab_reagents r ON r.id = tr.reagent_id
      ${where} ORDER BY tr.id
    `).all(...vals);
    return ok({ mappings });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('super_admin');
    const b = await req.json();
    const test_id = Number(b.test_id);
    const reagent_id = Number(b.reagent_id);
    if (!test_id || !reagent_id) return fail('test_id and reagent_id are required.');
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO lab_test_reagents (test_id, reagent_id, qty_per_test) VALUES (?, ?, ?)
       ON CONFLICT(test_id, reagent_id) DO UPDATE SET qty_per_test = excluded.qty_per_test`
    ).run(test_id, reagent_id, Number(b.qty_per_test || 1));
    return ok({ id: result.lastInsertRowid }, 201);
  } catch (err) { return handleApiError(err); }
}
