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
        const sale = await db.prepare(`SELECT ps.*, u.name AS sold_by_name FROM pharmacy_sales ps JOIN users u ON u.id=ps.sold_by_user_id WHERE ps.id=?`).get(id) as any;
        if (!sale)
            return fail('Sale not found.', 404);
        const items = await db.prepare(`SELECT * FROM pharmacy_sale_items WHERE sale_id=? ORDER BY id`).all(id) as any[];
        const clinic = getClinicInfo();
        const lines = items.map((i: any) => `• ${i.medicine_name} ×${i.qty} ${i.unit} = Rs.${i.total}`).join('\n');
        const msg = `*${clinic.name} — Pharmacy Receipt*\nSale No: ${sale.sale_no}\nDate: ${new Date(sale.created_at).toLocaleDateString('en-PK')}\nPatient: ${sale.patient_name}\n\n*Medicines:*\n${lines}\n\nSubtotal: Rs.${sale.subtotal}${sale.discount > 0 ? `\nDiscount: Rs.${sale.discount}` : ''}\n*Total: Rs.${sale.total}*\nPaid: Rs.${sale.paid_amount} (${sale.payment_status.toUpperCase()})\n${clinic.phone}`;
        await db.prepare(`UPDATE pharmacy_sales SET whatsapp_sent=1 WHERE id=?`).run(id);
        return ok({ shareLink: buildWhatsAppShareLink(sale.patient_phone || '', msg) });
    }
    catch (err) {
        return handleApiError(err);
    }
}
