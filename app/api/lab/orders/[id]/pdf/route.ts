import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';
import { generateBarcodePng } from '@/lib/barcode';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSession();
    const db = getDb();
    const id = Number(params.id);
    const order = db.prepare(
      `SELECT lo.*, u.name AS booked_by_name FROM lab_orders lo
       JOIN users u ON u.id = lo.booked_by_user_id WHERE lo.id = ?`
    ).get(id) as any;
    if (!order) return fail('Order not found.', 404);
    const items = db.prepare(`SELECT * FROM lab_order_items WHERE order_id = ? ORDER BY id`).all(id) as any[];
    const clinic = getClinicInfo();

    const PDFDocument = (await import('pdfkit')).default;
    const barcodeImg = await generateBarcodePng(order.order_no);

    const doc = new PDFDocument({ size: [420, 600], margin: 30 });
    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    await new Promise<void>((resolve) => {
      doc.on('end', resolve);

      // Header
      doc.rect(0, 0, 420, 60).fill('#0c1933');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14).text(clinic.name, 30, 18, { width: 360 });
      doc.font('Helvetica').fontSize(8).text(clinic.address, 30, 36).text(`${clinic.phone} | ${clinic.email || ''}`, 30, 46);

      // Order no strip
      doc.rect(0, 60, 420, 24).fill('#d62828');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
        .text('LAB ORDER / RECEIPT', 30, 67, { width: 200 })
        .text(order.order_no, 220, 67, { width: 170, align: 'right' });

      // Patient details
      doc.fillColor('#0c1933').font('Helvetica-Bold').fontSize(9).text('PATIENT DETAILS', 30, 100);
      doc.moveTo(30, 111).lineTo(390, 111).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.fillColor('#374151').font('Helvetica').fontSize(9);
      const details = [
        ['Name', order.patient_name],
        ['Phone', order.patient_phone || '—'],
        ['Age / Gender', `${order.patient_age || '—'} / ${order.patient_gender || '—'}`],
        ['Referred by', order.referring_doctor ? `Dr. ${order.referring_doctor}` : '—'],
        ['Booked by', order.booked_by_name],
        ['Date', new Date(order.created_at).toLocaleString('en-PK')],
        ['Status', order.status.toUpperCase()],
      ];
      let y = 118;
      for (const [label, value] of details) {
        doc.fillColor('#6b7280').text(label + ':', 30, y, { width: 100 });
        doc.fillColor('#111827').text(String(value), 130, y, { width: 260 });
        y += 14;
      }

      // Tests
      y += 6;
      doc.fillColor('#0c1933').font('Helvetica-Bold').fontSize(9).text('TESTS ORDERED', 30, y);
      y += 12;
      doc.moveTo(30, y).lineTo(390, y).strokeColor('#e5e7eb').stroke();
      y += 6;

      for (const item of items) {
        doc.fillColor('#111827').font('Helvetica').fontSize(9).text(item.test_name, 30, y, { width: 280 });
        doc.text(`Rs. ${item.price}`, 310, y, { width: 80, align: 'right' });
        y += 13;
        doc.moveTo(30, y).lineTo(390, y).strokeColor('#f3f4f6').stroke();
        y += 3;
      }

      // Totals
      y += 6;
      doc.rect(30, y, 360, order.discount > 0 ? 58 : 44).fill('#f9fafb');
      doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text('Subtotal:', 40, y + 6).text(`Rs. ${order.subtotal}`, 310, y + 6, { width: 70, align: 'right' });
      if (order.discount > 0) {
        doc.text('Discount:', 40, y + 20).text(`Rs. ${order.discount}`, 310, y + 20, { width: 70, align: 'right' });
        y += 14;
      }
      doc.fillColor('#0c1933').font('Helvetica-Bold').fontSize(10).text('TOTAL:', 40, y + 20).text(`Rs. ${order.total}`, 310, y + 20, { width: 70, align: 'right' });
      doc.fillColor('#059669').font('Helvetica').fontSize(9).text(`Paid (${order.payment_method.toUpperCase()}):`, 40, y + 34).text(`Rs. ${order.paid_amount}`, 310, y + 34, { width: 70, align: 'right' });
      y += 58;

      // Barcode
      y += 10;
      doc.image(barcodeImg, 110, y, { width: 200, height: 50 });
      doc.fillColor('#9ca3af').font('Helvetica').fontSize(7).text(order.order_no, 30, y + 52, { width: 360, align: 'center' });

      // Footer
      doc.fillColor('#9ca3af').fontSize(7).text('Please present this receipt when collecting reports.', 30, y + 65, { width: 360, align: 'center' });

      doc.end();
    });

    const pdf = Buffer.concat(buffers);
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${order.order_no}.pdf"`,
      }
    });
  } catch (err) { return handleApiError(err); }
}
