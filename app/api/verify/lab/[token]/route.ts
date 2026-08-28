import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { ok } from '@/lib/http';
// Intentionally public — no requireSession(). Only returns non-clinical confirmation
// fields (order no, patient name, report date, signed-by) so a report can be verified
// by anyone who scans its QR code without leaking test results/PHI.
export async function GET(_req: NextRequest, { params }: {
    params: {
        token: string;
    };
}) {
    const db = await getDb();
    const order = await db.prepare(`SELECT lo.order_no, lo.patient_name, lo.reported_at, u.name AS reported_by_name
     FROM lab_orders lo LEFT JOIN users u ON u.id = lo.reported_by_user_id
     WHERE lo.verification_token = ? AND lo.report_status = 'reported'`).get(params.token) as any;
    if (!order)
        return ok({ verified: false });
    return ok({
        verified: true,
        order_no: order.order_no,
        patient_name: order.patient_name,
        report_date: order.reported_at,
        signed_by: order.reported_by_name
    });
}
