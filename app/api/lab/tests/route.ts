import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const q = req.nextUrl.searchParams.get('q')?.trim();
        const all = req.nextUrl.searchParams.get('all') === '1';
        const conds: string[] = [];
        const vals: any[] = [];
        if (!all)
            conds.push('active = 1');
        if (q) {
            conds.push('(name LIKE ? OR category LIKE ?)');
            vals.push(`%${q}%`, `%${q}%`);
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const tests = await db.prepare(`SELECT * FROM lab_tests ${where} ORDER BY category ASC, name ASC`).all(...vals);
        return ok({ tests });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        await requireRole('super_admin');
        const b = await req.json();
        const name = String(b.name || '').trim();
        if (!name)
            return fail('Test name is required.');
        const db = await getDb();
        const result = await db.prepare(`INSERT INTO lab_tests (name, category, price, turnaround, description, default_sample_type, turnaround_hours, is_culture)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(name, b.category || null, Number(b.price || 0), b.turnaround || '24 hours', b.description || null, b.default_sample_type || 'blood', b.turnaround_hours ? Number(b.turnaround_hours) : null, b.is_culture ? 1 : 0);
        return ok({ id: result.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
