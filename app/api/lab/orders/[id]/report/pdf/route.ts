import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';
import { buildLabReportData, generateLabReportPdf } from '@/lib/lab-report-pdf';
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
