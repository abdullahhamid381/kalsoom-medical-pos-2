import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

export async function GET() {
  try {
    await requireSession();
    const db = getDb();
    const doctors = db.prepare(`SELECT * FROM doctors ORDER BY active DESC, name ASC`).all();
    return ok({ doctors });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('super_admin');
    const body = await req.json();
    const name = String(body.name || '').trim();
    const specialization = String(body.specialization || '').trim();
    const department = String(body.department || 'General').trim();
    const fee = Number(body.fee || 0);
    const availability = String(body.availability || 'Mon-Sat, 9:00 AM - 5:00 PM').trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const description = body.description ? String(body.description).trim() : null;

    if (!name || !specialization) return fail('Doctor name and specialization are required.');

    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO doctors (name, specialization, department, fee, availability, phone, description) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, specialization, department, fee, availability, phone, description);

    return ok({ id: result.lastInsertRowid }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
