import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';
import { buildLabReportData, generateLabReportPdf } from '@/lib/lab-report-pdf';
import { sendPdfOnWhatsApp, buildWhatsAppShareLink } from '@/lib/whatsapp';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const db = getDb();
    const id = Number(params.id);
    const order = db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(id) as any;
    if (!order) return fail('Order not found.', 404);
    if (order.report_status !== 'reported') return fail('Finalize the report before sending it.');
    if (!order.patient_phone) return fail('This patient has no phone number on file.');

    const clinic = getClinicInfo();
    const data = buildLabReportData(db, id, req.nextUrl.origin, clinic);
    if (!data) return fail('Order not found.', 404);

    const caption = `*${clinic.name} — Lab Report*\nReport No: ${order.order_no}\nPatient: ${order.patient_name}\nDate: ${new Date(order.created_at).toLocaleDateString('en-PK')}\n${clinic.phone}`;
    const pdfBuffer = await generateLabReportPdf(data);
    const fileName = `${order.order_no}-report.pdf`;

    const sendResult = await sendPdfOnWhatsApp({ phone: order.patient_phone, caption, pdfBuffer, fileName });
    if (sendResult.ok) {
      db.prepare(`UPDATE lab_orders SET report_whatsapp_sent = 1, report_whatsapp_sent_at = datetime('now') WHERE id = ?`).run(id);
      return ok({ sent: true });
    }

    // WhatsApp session not connected (or send failed) — fall back to a manual share link.
    return ok({ sent: false, error: sendResult.error, shareLink: buildWhatsAppShareLink(order.patient_phone, caption) });
  } catch (err) { return handleApiError(err); }
}
