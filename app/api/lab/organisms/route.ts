import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const db = getDb();
    const q = req.nextUrl.searchParams.get('q')?.trim();
    const conds: string[] = ['active = 1'];
    const vals: any[] = [];
    if (q) { conds.push('name LIKE ?'); vals.push(`%${q}%`); }
    const organisms = db.prepare(`SELECT * FROM lab_organisms WHERE ${conds.join(' AND ')} ORDER BY name ASC`).all(...vals);
    return ok({ organisms });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('super_admin', 'lab_technician', 'lab_senior_technologist', 'lab_pathologist');
    const b = await req.json();
    const name = String(b.name || '').trim();
    if (!name) return fail('Organism name is required.');
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO lab_organisms (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET active = 1`
    ).run(name);
    const organism = db.prepare(`SELECT * FROM lab_organisms WHERE name = ?`).get(name);
    return ok({ organism }, 201);
  } catch (err) { return handleApiError(err); }
}
