import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const all = req.nextUrl.searchParams.get('all') === '1';
        const q = req.nextUrl.searchParams.get('q')?.trim();
        const conds: string[] = [];
        const vals: any[] = [];
        if (!all)
            conds.push('active = 1');
        if (q) {
            conds.push('(name LIKE ? OR category LIKE ?)');
            vals.push(`%${q}%`, `%${q}%`);
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const types = await db.prepare(`SELECT * FROM surgery_types ${where} ORDER BY category, name`).all(...vals);
        return ok({ types });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        await requireRole('super_admin');
        const b = await req.json();
        if (!b.name?.trim())
            return fail('Surgery name is required.');
        const db = await getDb();
        const r = await db.prepare(`INSERT INTO surgery_types (name, category, base_price, description, duration_hrs) VALUES (?, ?, ?, ?, ?)`).run(b.name.trim(), b.category || null, Number(b.base_price || 0), b.description || null, Number(b.duration_hrs || 1));
        return ok({ id: r.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
