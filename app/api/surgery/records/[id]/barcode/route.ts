import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { generateBarcodePng } from '@/lib/barcode';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const db = getDb();
    const rec = db.prepare(`SELECT surgery_no FROM surgery_records WHERE id = ?`).get(Number(params.id)) as { surgery_no: string } | undefined;
    if (!rec) return fail('Record not found.', 404);
    const png = await generateBarcodePng(rec.surgery_no);
    return new NextResponse(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
  } catch (err) { return handleApiError(err); }
}
