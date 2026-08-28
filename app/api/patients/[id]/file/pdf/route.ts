import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';
import { getPatientLedger } from '@/lib/patient-ledger';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
function money(n: number) { return `Rs. ${Number(n || 0).toLocaleString('en-PK')}`; }
export async function GET(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'receptionist', 'receptionist_admin', 'doctor');
        const id = Number(params.id);
        const sp = req.nextUrl.searchParams;
        const from = sp.get('from') || undefined;
        const to = sp.get('to') || undefined;
        const ledger = await getPatientLedger(id, from, to);
        if (!ledger)
            return fail('Patient not found.', 404);
        const { patient, timeline, summary } = ledger;
        const clinic = getClinicInfo();
        const PDFDocument = (await import('pdfkit')).default;
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const buffers: Buffer[] = [];
        doc.on('data', (c: Buffer) => buffers.push(c));
        await new Promise<void>((resolve) => {
            doc.on('end', resolve);
            doc.rect(0, 0, 595, 70).fill('#0c1933');
            doc.fillColor('#fff').font('Helvetica-Bold').fontSize(18).text(clinic.name, 40, 18);
            doc.font('Helvetica').fontSize(9).text(`${clinic.address} | ${clinic.phone}`, 40, 40);
            doc.fillColor('#d62828').fontSize(11).font('Helvetica-Bold').text('PATIENT FINANCIAL STATEMENT', 40, 52);
            doc.rect(0, 70, 595, 24).fill('#f3f4f6');
            doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9)
                .text(`Period: ${from && to ? `${from} to ${to}` : 'All Time'}`, 40, 78, { width: 300 })
                .text(`Generated: ${new Date().toLocaleDateString('en-PK')}`, 340, 78, { width: 215, align: 'right' });
            let y = 108;
            const info = [
                ['Patient', patient.full_name], ['Phone', patient.phone || '—'],
                ['Age / Gender', `${patient.age || '—'} / ${patient.gender || '—'}`],
                ['CNIC', patient.cnic || '—']
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
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#0c1933').text('TRANSACTION TIMELINE', 40, y);
            y += 14;
            doc.rect(40, y, 515, 16).fill('#1e3a5f');
            doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8)
                .text('Date', 45, y + 4, { width: 55 })
                .text('Category', 100, y + 4, { width: 60 })
                .text('Description', 160, y + 4, { width: 150 })
                .text('Billed', 315, y + 4, { width: 65, align: 'right' })
                .text('Disc.', 380, y + 4, { width: 50, align: 'right' })
                .text('Paid', 430, y + 4, { width: 60, align: 'right' })
                .text('Due', 490, y + 4, { width: 60, align: 'right' });
            y += 16;
            timeline.forEach((e, i) => {
                if (y > 720) {
                    doc.addPage();
                    y = 40;
                }
                doc.rect(40, y, 515, 14).fill(i % 2 === 0 ? '#f9fafb' : '#fff');
                doc.fillColor('#374151').font('Helvetica').fontSize(7.5)
                    .text(e.date, 45, y + 3, { width: 55 })
                    .text(e.categoryLabel, 100, y + 3, { width: 60 })
                    .text(`${e.no} — ${e.description}`, 160, y + 3, { width: 150 })
                    .text(money(e.billed), 315, y + 3, { width: 65, align: 'right' })
                    .text(money(e.discount), 380, y + 3, { width: 50, align: 'right' })
                    .text(money(e.paid), 430, y + 3, { width: 60, align: 'right' })
                    .fillColor(e.outstanding > 0 ? '#d62828' : '#374151')
                    .text(money(e.outstanding), 490, y + 3, { width: 60, align: 'right' });
                y += 14;
            });
            if (timeline.length === 0) {
                doc.fillColor('#9ca3af').font('Helvetica').fontSize(9).text('No transactions in this period.', 40, y);
                y += 20;
            }
            y += 10;
            if (y > 680) {
                doc.addPage();
                y = 40;
            }
            doc.rect(300, y, 255, 82).fill('#f3f4f6');
            const totRows: [
                string,
                string
            ][] = [
                ['Total Billed', money(summary.totalBilled)],
                ['Total Discount', money(summary.totalDiscount)],
                ['Total Paid', money(summary.totalPaid)]
            ];
            let ty = y + 8;
            for (const [l, v] of totRows) {
                doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text(l + ':', 310, ty, { width: 130 });
                doc.fillColor('#111827').font('Helvetica-Bold').text(v, 445, ty, { width: 100, align: 'right' });
                ty += 16;
            }
            doc.moveTo(310, ty).lineTo(545, ty).strokeColor('#d1d5db').stroke();
            ty += 6;
            doc.fillColor('#d62828').font('Helvetica-Bold').fontSize(11)
                .text('Outstanding Balance:', 310, ty, { width: 130 })
                .text(money(summary.totalOutstanding), 445, ty, { width: 100, align: 'right' });
            doc.fillColor('#9ca3af').font('Helvetica').fontSize(8)
                .text(`Generated: ${new Date().toLocaleString('en-PK')} | ${clinic.name}`, 40, 770, { width: 515, align: 'center' });
            doc.end();
        });
        const pdf = Buffer.concat(buffers);
        return new NextResponse(pdf, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${patient.full_name.replace(/\s+/g, '_')}-statement.pdf"`
            }
        });
    }
    catch (err) {
        return handleApiError(err);
    }
}
