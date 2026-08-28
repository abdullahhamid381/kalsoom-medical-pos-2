import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';
import { buildLabReportData, generateLabReportPdf } from '@/lib/lab-report-pdf';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const data = await buildLabReportData(db, id, req.nextUrl.origin, getClinicInfo());
        if (!data)
            return fail('Order not found.', 404);
        const pdf = await generateLabReportPdf(data);
        return new NextResponse(pdf, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${data.order.order_no}-report.pdf"`
            }
        });
    }
    catch (err) {
        return handleApiError(err);
    }
}
