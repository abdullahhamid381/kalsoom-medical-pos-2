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
    let sql = `SELECT * FROM suppliers`;
    const vals: any[] = [];
    const conds: string[] = [];
    if (!all) conds.push('active = 1');
    if (q) { conds.push('(name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)'); vals.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ' ORDER BY name ASC';
    const suppliers = db.prepare(sql).all(...vals);
    return ok({ suppliers });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('super_admin', 'pharmacy_admin');
    const b = await req.json();
    const name = String(b.name || '').trim();
    if (!name) return fail('Supplier name is required.');
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO suppliers (name, contact_person, phone, email, address, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, b.contact_person||null, b.phone||null, b.email||null, b.address||null, b.notes||null);
    return ok({ id: result.lastInsertRowid }, 201);
  } catch (err) { return handleApiError(err); }
}
