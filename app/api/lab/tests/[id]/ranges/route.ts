import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const ranges = await db.prepare(`SELECT * FROM lab_test_reference_ranges WHERE test_id = ? ORDER BY gender ASC, age_min ASC`).all(Number(params.id));
        return ok({ ranges });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin');
        const db = await getDb();
        const testId = Number(params.id);
        const b = await req.json();
        const valueType = b.value_type === 'text' ? 'text' : 'numeric';
        const r = await db.prepare(`INSERT INTO lab_test_reference_ranges
         (test_id, gender, age_min, age_max, value_type, low, high, unit, normal_text, critical_low, critical_high, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(testId, b.gender || 'any', Number(b.age_min ?? 0), Number(b.age_max ?? 150), valueType, valueType === 'numeric' && b.low !== undefined && b.low !== '' ? Number(b.low) : null, valueType === 'numeric' && b.high !== undefined && b.high !== '' ? Number(b.high) : null, b.unit || null, valueType === 'text' ? (b.normal_text || null) : null, b.critical_low !== undefined && b.critical_low !== '' ? Number(b.critical_low) : null, b.critical_high !== undefined && b.critical_high !== '' ? Number(b.critical_high) : null, b.notes || null);
        return ok({ id: r.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
