import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const db = getDb();
    const q = req.nextUrl.searchParams.get('q')?.trim();
    const all = req.nextUrl.searchParams.get('all') === '1';
    const conds: string[] = [];
    const vals: any[] = [];
    if (!all) conds.push('active = 1');
    if (q) { conds.push('name LIKE ?'); vals.push(`%${q}%`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const doctors = db.prepare(`SELECT * FROM lab_referring_doctors ${where} ORDER BY name ASC`).all(...vals);
    return ok({ doctors });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('super_admin', 'receptionist', 'lab_technician', 'lab_senior_technologist', 'lab_pathologist');
    const b = await req.json();
    const name = String(b.name || '').trim();
    if (!name) return fail('Doctor name is required.');
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO lab_referring_doctors (name, phone, commission_percent) VALUES (?, ?, ?)`
    ).run(name, b.phone || null, Number(b.commission_percent || 0));
    const doctor = db.prepare(`SELECT * FROM lab_referring_doctors WHERE id = ?`).get(result.lastInsertRowid);
    return ok({ doctor }, 201);
  } catch (err) { return handleApiError(err); }
}
