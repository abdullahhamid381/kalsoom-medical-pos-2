import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';
import { buildWhatsAppShareLink } from '@/lib/whatsapp';
export async function POST(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const order = await db.prepare(`SELECT lo.*, u.name AS booked_by_name FROM lab_orders lo JOIN users u ON u.id=lo.booked_by_user_id WHERE lo.id=?`).get(id) as any;
        if (!order)
            return fail('Order not found.', 404);
        const items = await db.prepare(`SELECT * FROM lab_order_items WHERE order_id=? ORDER BY id`).all(id) as any[];
        const clinic = getClinicInfo();
        const lines = items.map((i: any) => `• ${i.test_name} — Rs.${i.price}`).join('\n');
        const msg = `*${clinic.name} — Lab Receipt*\nOrder No: ${order.order_no}\nDate: ${new Date(order.created_at).toLocaleDateString('en-PK')}\nPatient: ${order.patient_name}${order.patient_age ? ` (${order.patient_age} yrs)` : ''}\n${order.referring_doctor ? `Referred by: Dr.${order.referring_doctor}\n` : ''}\n*Tests:*\n${lines}\n\n${order.discount > 0 ? `Discount: Rs.${order.discount}\n` : ''}_Total: Rs.${order.total}*\nPaid: Rs.${order.paid_amount} (${order.payment_status.toUpperCase()})\nStatus: ${order.status.toUpperCase()}\n${clinic.phone}`;
        await db.prepare(`UPDATE lab_orders SET whatsapp_sent=1 WHERE id=?`).run(id);
        return ok({ shareLink: buildWhatsAppShareLink(order.patient_phone || '', msg) });
    }
    catch (err) {
        return handleApiError(err);
    }
}
