import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { generateBarcodePng } from '@/lib/barcode';

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
        const rec = await db.prepare(`SELECT surgery_no FROM surgery_records WHERE id = ?`).get(Number(params.id)) as {
            surgery_no: string;
        } | undefined;
        if (!rec)
            return fail('Record not found.', 404);
        const png = await generateBarcodePng(rec.surgery_no);
        return new NextResponse(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
    }
    catch (err) {
        return handleApiError(err);
    }
}
