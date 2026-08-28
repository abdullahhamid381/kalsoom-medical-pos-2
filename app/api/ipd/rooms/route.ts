import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession, requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const available = req.nextUrl.searchParams.get('available') === '1';
        const all = req.nextUrl.searchParams.get('all') === '1';
        const conds: string[] = [];
        if (!all)
            conds.push('active = 1');
        if (available)
            conds.push("status = 'available'");
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const rooms = await db.prepare(`SELECT * FROM rooms ${where} ORDER BY room_no ASC`).all();
        return ok({ rooms });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        await requireRole('super_admin', 'ward_admin');
        const b = await req.json();
        if (!b.room_no?.trim())
            return fail('Room number is required.');
        const db = await getDb();
        const exists = await db.prepare(`SELECT id FROM rooms WHERE room_no = ?`).get(b.room_no.trim());
        if (exists)
            return fail('Room number already exists.');
        const result = await db.prepare(`INSERT INTO rooms (room_no, room_type, floor, price_per_day, description) VALUES (?, ?, ?, ?, ?)`).run(b.room_no.trim(), b.room_type || 'general', b.floor || null, Number(b.price_per_day || 0), b.description || null);
        return ok({ id: result.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
