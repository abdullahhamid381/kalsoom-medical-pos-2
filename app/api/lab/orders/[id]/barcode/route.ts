import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { generateBarcodePng } from '@/lib/barcode';
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const order = await db.prepare(`SELECT order_no FROM lab_orders WHERE id = ?`).get(Number(params.id)) as {
            order_no: string;
        } | undefined;
        if (!order)
            return fail('Order not found.', 404);
        const png = await generateBarcodePng(order.order_no);
        return new NextResponse(png, {
            status: 200,
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' }
        });
    }
    catch (err) {
        return handleApiError(err);
    }
}
