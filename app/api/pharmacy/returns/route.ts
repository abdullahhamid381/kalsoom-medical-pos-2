import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const conds: string[] = [];
        const vals: any[] = [];
        const from = sp.get('from');
        const to = sp.get('to');
        const q = sp.get('q')?.trim();
        if (from) {
            conds.push('LEFT(psr.created_at, 10) >= ?');
            vals.push(from);
        }
        if (to) {
            conds.push('LEFT(psr.created_at, 10) <= ?');
            vals.push(to);
        }
        if (q) {
            conds.push('(ps.sale_no LIKE ? OR ps.patient_name LIKE ? OR psr.return_no LIKE ?)');
            vals.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const returns = await db.prepare(`SELECT psr.*, ps.sale_no, ps.patient_name, ps.patient_phone, u.name AS created_by_name
       FROM pharmacy_sale_returns psr
       JOIN pharmacy_sales ps ON ps.id = psr.sale_id
       JOIN users u ON u.id = psr.created_by_user_id
       ${where}
       ORDER BY psr.created_at DESC LIMIT 500`).all(...vals);
        return ok({ returns });
    }
    catch (err) {
        return handleApiError(err);
    }
}
