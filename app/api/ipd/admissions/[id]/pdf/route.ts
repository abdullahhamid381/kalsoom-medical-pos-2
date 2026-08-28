import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
const CHARGE_LABELS: Record<string, string> = {
    room: 'Room Charges', medicine: 'Medicine & Nursing', lab: 'Lab Tests',
    procedure: 'Procedures', doctor_fee: 'Doctor Fee', nursing: 'Nursing Care', other: 'Other Charges'
};
const PAY: Record<string, string> = { cash: 'Cash', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa', bank_transfer: 'Bank Transfer', card: 'Card' };
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const adm = await db.prepare(`
      SELECT a.*, p.full_name AS patient_name, p.phone AS patient_phone, p.age AS patient_age,
        p.gender AS patient_gender, p.cnic AS patient_cnic, p.address AS patient_address,
        r.room_no, r.room_type, r.floor, d.name AS doctor_name, d.specialization,
        u.name AS admitted_by_name
      FROM admissions a JOIN patients p ON p.id = a.patient_id JOIN rooms r ON r.id = a.room_id
      LEFT JOIN doctors d ON d.id = a.doctor_id JOIN users u ON u.id = a.admitted_by_user_id
      WHERE a.id = ?
    `).get(id) as any;
        if (!adm)
            return fail('Admission not found.', 404);
        const charges = await db.prepare(`SELECT ac.*, u2.name AS added_by_name FROM admission_charges ac
       JOIN users u2 ON u2.id = ac.added_by_user_id
       WHERE ac.admission_id = ? ORDER BY ac.charge_date, ac.created_at`).all(id) as any[];
        const clinic = getClinicInfo();
        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', (c: Buffer) => buffers.push(c));
        await new Promise<void>(resolve => {
            doc.on('end', resolve);
            // Header
            doc.rect(0, 0, 595, 70).fill('#0c1933');
            doc.fillColor('#fff').font('Helvetica-Bold').fontSize(18).text(clinic.name, 40, 18);
            doc.font('Helvetica').fontSize(9).text(`${clinic.address} | ${clinic.phone}`, 40, 40);
            doc.fillColor('#d62828').fontSize(11).font('Helvetica-Bold').text('IN-PATIENT DISCHARGE BILL', 40, 52);
            // Admission info strip
            doc.rect(0, 70, 595, 28).fill('#f3f4f6');
            doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10)
                .text(`Admission No: ${adm.admission_no}`, 40, 80, { width: 250 })
                .text(`Status: ${adm.status.toUpperCase()}`, 300, 80, { width: 255, align: 'right' });
            let y = 115;
            // Patient + Room info
            const info = [
                ['Patient', adm.patient_name], ['Phone', adm.patient_phone || '—'],
                ['Age / Gender', `${adm.patient_age || '—'} / ${adm.patient_gender || '—'}`],
                ['CNIC', adm.patient_cnic || '—'], ['Room', `${adm.room_no} (${adm.room_type?.replace('_', ' ')} | Floor: ${adm.floor || '—'})`],
                ['Doctor', adm.doctor_name ? `Dr. ${adm.doctor_name}` : '—'],
                ['Diagnosis', adm.diagnosis || '—'],
                ['Admitted', `${adm.admission_date} ${adm.admission_time}`],
                ['Discharged', adm.discharge_date ? `${adm.discharge_date} ${adm.discharge_time}` : '—'],
                ['Days Stayed', String(adm.days_stayed || '—')],
            ];
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#0c1933').text('PATIENT INFORMATION', 40, y);
            y += 14;
            doc.moveTo(40, y).lineTo(555, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
            y += 6;
            for (const [label, value] of info) {
                doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text(label + ':', 40, y, { width: 100 });
                doc.fillColor('#111827').text(String(value), 145, y, { width: 410 });
                y += 14;
            }
            y += 8;
            // Charges table
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#0c1933').text('CHARGES DETAIL', 40, y);
            y += 14;
            doc.rect(40, y, 515, 16).fill('#1e3a5f');
            doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8)
                .text('Date', 45, y + 4, { width: 70 })
                .text('Type', 120, y + 4, { width: 80 })
                .text('Description', 205, y + 4, { width: 180 })
                .text('Qty', 390, y + 4, { width: 40, align: 'right' })
                .text('Unit', 435, y + 4, { width: 55, align: 'right' })
                .text('Total', 495, y + 4, { width: 55, align: 'right' });
            y += 16;
            for (const c of charges) {
                if (y > 720) {
                    doc.addPage();
                    y = 40;
                }
                const bg = charges.indexOf(c) % 2 === 0 ? '#f9fafb' : '#fff';
                doc.rect(40, y, 515, 14).fill(bg);
                doc.fillColor('#374151').font('Helvetica').fontSize(8)
                    .text(c.charge_date, 45, y + 3, { width: 70 })
                    .text(CHARGE_LABELS[c.charge_type] || c.charge_type, 120, y + 3, { width: 80 })
                    .text(c.description, 205, y + 3, { width: 180 })
                    .text(String(c.quantity), 390, y + 3, { width: 40, align: 'right' })
                    .text(`Rs. ${c.unit_price}`, 435, y + 3, { width: 55, align: 'right' })
                    .text(`Rs. ${c.total}`, 495, y + 3, { width: 55, align: 'right' });
                y += 14;
            }
            // Totals
            y += 10;
            doc.rect(300, y, 255, adm.discount > 0 ? 82 : 68).fill('#f3f4f6');
            const totRows = [
                ['Room Charges', `Rs. ${adm.room_charge_total}`],
                ['Medicine & Nursing', `Rs. ${adm.medicine_total}`],
                ['Lab Tests', `Rs. ${adm.lab_total}`],
                ['Procedures', `Rs. ${adm.procedure_total}`],
                ['Other', `Rs. ${adm.other_total}`],
            ];
            let ty = y + 6;
            for (const [l, v] of totRows) {
                doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text(l + ':', 310, ty, { width: 130 });
                doc.fillColor('#111827').text(v, 445, ty, { width: 100, align: 'right' });
                ty += 13;
            }
            doc.moveTo(310, ty).lineTo(545, ty).strokeColor('#d1d5db').stroke();
            ty += 4;
            doc.fillColor('#0c1933').font('Helvetica-Bold').fontSize(10)
                .text('Grand Total:', 310, ty, { width: 130 })
                .text(`Rs. ${adm.grand_total}`, 445, ty, { width: 100, align: 'right' });
            ty += 14;
            if (adm.discount > 0) {
                doc.fillColor('#d62828').font('Helvetica').fontSize(9).text('Discount:', 310, ty, { width: 130 }).text(`-Rs. ${adm.discount}`, 445, ty, { width: 100, align: 'right' });
                ty += 13;
            }
            doc.fillColor('#059669').font('Helvetica-Bold').fontSize(9)
                .text(`Paid (${PAY[adm.payment_method] || '—'}):`, 310, ty, { width: 130 })
                .text(`Rs. ${adm.paid_amount}`, 445, ty, { width: 100, align: 'right' });
            if (adm.grand_total - adm.discount - adm.paid_amount > 0) {
                ty += 13;
                doc.fillColor('#d62828').font('Helvetica-Bold').fontSize(10)
                    .text('Balance Due:', 310, ty, { width: 130 })
                    .text(`Rs. ${adm.grand_total - adm.discount - adm.paid_amount}`, 445, ty, { width: 100, align: 'right' });
            }
            // Footer
            doc.fillColor('#9ca3af').font('Helvetica').fontSize(8)
                .text(`Generated: ${new Date().toLocaleString('en-PK')} | ${clinic.name}`, 40, 770, { width: 515, align: 'center' });
            doc.end();
        });
        const pdf = Buffer.concat(buffers);
        return new NextResponse(pdf, {
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${adm.admission_no}.pdf"` }
        });
    }
    catch (err) {
        return handleApiError(err);
    }
}
