import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { generateQrPng } from '@/lib/qrcode';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const db = getDb();
    const id = Number(params.id);
    const order = db.prepare(`SELECT verification_token FROM lab_orders WHERE id = ?`).get(id) as { verification_token: string | null } | undefined;
    if (!order) return fail('Order not found.', 404);
    if (!order.verification_token) return fail('Report has not been finalized yet.', 409);
    const url = `${req.nextUrl.origin}/verify/lab/${order.verification_token}`;
    const png = await generateQrPng(url);
    return new NextResponse(png, { status: 200, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
  } catch (err) { return handleApiError(err); }
}
