import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const phone = req.nextUrl.searchParams.get('phone')?.trim();
        if (!phone) {
            // No phone given: return a report — all-time per-customer balances, plus
            // issued/redeemed totals and a daily breakdown scoped to from/to.
            const from = req.nextUrl.searchParams.get('from');
            const to = req.nextUrl.searchParams.get('to');
            const conds: string[] = [];
            const vals: any[] = [];
            if (from) {
                conds.push('LEFT(created_at, 10) >= ?');
                vals.push(from);
            }
            if (to) {
                conds.push('LEFT(created_at, 10) <= ?');
                vals.push(to);
            }
            const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
            const customers = await db.prepare(`SELECT phone, MAX(customer_name) AS customer_name, SUM(amount) AS balance
         FROM customer_credits GROUP BY phone HAVING SUM(amount) != 0 ORDER BY balance DESC`).all();
            const totals = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS issued,
                COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS redeemed
         FROM customer_credits ${where}`).get(...vals);
            const byDay = await db.prepare(`SELECT LEFT(created_at, 10) AS date,
                COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS issued,
                COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS redeemed
         FROM customer_credits ${where} GROUP BY LEFT(created_at, 10) ORDER BY date ASC`).all(...vals);
            const totalOutstanding = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS balance FROM customer_credits`).get() as {
                balance: number;
            };
            return ok({ customers, totals, byDay, totalOutstanding: totalOutstanding.balance });
        }
        const entries = await db.prepare(`SELECT cc.*, u.name AS created_by_name FROM customer_credits cc
       JOIN users u ON u.id = cc.created_by_user_id
       WHERE cc.phone = ? ORDER BY cc.created_at DESC`).all(phone);
        const balanceRow = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS balance FROM customer_credits WHERE phone = ?`).get(phone) as {
            balance: number;
        };
        return ok({ entries, balance: balanceRow.balance });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        const session = await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const b = await req.json();
        const phone = String(b.phone || '').trim();
        if (!phone)
            return fail('Customer phone is required.');
        const amount = Number(b.amount || 0);
        if (amount === 0)
            return fail('Adjustment amount cannot be zero.');
        await db.prepare(`INSERT INTO customer_credits (phone, customer_name, amount, source, notes, created_by_user_id)
       VALUES (?, ?, ?, 'manual', ?, ?)`).run(phone, b.customer_name || null, amount, b.notes || null, session.id);
        const balanceRow = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS balance FROM customer_credits WHERE phone = ?`).get(phone) as {
            balance: number;
        };
        return ok({ balance: balanceRow.balance }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
