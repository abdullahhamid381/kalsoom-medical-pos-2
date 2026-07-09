import PDFDocument from 'pdfkit';
import { generateBarcodePng } from './barcode';

export type SlipData = {
  clinic: { name: string; address: string; phone: string; email: string };
  appointment: {
    appointment_no: string;
    token_number: number;
    appointment_date: string;
    appointment_time: string;
    department: string | null;
    reason: string | null;
    payment_method: string;
    amount: number;
    discount: number;
    paid_amount: number;
    payment_status: string;
    status: string;
    notes: string | null;
    created_at: string;
  };
  patient: {
    full_name: string;
    phone: string;
    cnic: string | null;
    age: number | null;
    gender: string;
    address: string | null;
  };
  doctor: { name: string; specialization: string; department: string; fee: number };
  bookedBy: { name: string };
};

const NAVY = '#13244a';
const NAVY_DARK = '#0c1933';
const CRIMSON = '#d62828';
const SLATE = '#475467';
const LIGHT = '#f5f7fb';
const BORDER = '#e3e7ef';

const PAY_LABELS: Record<string, string> = {
  cash: 'Cash',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
  bank_transfer: 'Bank Transfer',
  card: 'Card'
};

function fmtMoney(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}`;
}

export async function generateAppointmentPdf(data: SlipData): Promise<Buffer> {
  const barcodePng = await generateBarcodePng(data.appointment.appointment_no);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [420, 650], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 420;
    let y = 0;

    // ---------- Header band ----------
    doc.rect(0, 0, W, 96).fill(NAVY);
    doc.rect(0, 90, W, 6).fill(CRIMSON);

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(19)
      .text(data.clinic.name.toUpperCase(), 24, 22, { width: W - 48 });

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#cfd9ec')
      .text(data.clinic.address, 24, 46, { width: W - 48 })
      .text(`${data.clinic.phone}   |   ${data.clinic.email}`, 24, 60, { width: W - 48 });

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#ffd9d9')
      .text('APPOINTMENT SLIP', 24, 76);

    y = 112;

    // ---------- Appointment no / token strip ----------
    doc.roundedRect(24, y, W - 48, 46, 4).fillAndStroke(LIGHT, BORDER);
    doc.fillColor(SLATE).font('Helvetica').fontSize(7.5).text('APPOINTMENT NO.', 36, y + 8);
    doc.fillColor(NAVY_DARK).font('Helvetica-Bold').fontSize(12).text(data.appointment.appointment_no, 36, y + 19);

    doc.fillColor(SLATE).font('Helvetica').fontSize(7.5).text('TOKEN', 230, y + 8);
    doc.fillColor(CRIMSON).font('Helvetica-Bold').fontSize(16).text(`#${data.appointment.token_number}`, 230, y + 17);

    const statusColor = data.appointment.status === 'cancelled' ? CRIMSON : NAVY;
    doc.fillColor(SLATE).font('Helvetica').fontSize(7.5).text('STATUS', 320, y + 8);
    doc
      .fillColor(statusColor)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(data.appointment.status.replace('_', ' ').toUpperCase(), 320, y + 19, { width: 80 });

    y += 62;

    // ---------- Patient details ----------
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('PATIENT DETAILS', 24, y);
    doc.moveTo(24, y + 13).lineTo(W - 24, y + 13).lineWidth(1).strokeColor(BORDER).stroke();
    y += 22;

    const patientRows: [string, string][] = [
      ['Full Name', data.patient.full_name],
      ['Phone', data.patient.phone],
      ['CNIC', data.patient.cnic || '-'],
      ['Age / Gender', `${data.patient.age ?? '-'} yrs / ${data.patient.gender}`],
      ['Address', data.patient.address || '-']
    ];
    for (const [label, value] of patientRows) {
      doc.font('Helvetica').fontSize(8).fillColor(SLATE).text(label, 24, y, { width: 110 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY_DARK).text(value, 140, y, { width: W - 164 });
      y += 16;
    }

    y += 6;

    // ---------- Doctor / appointment details ----------
    doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('APPOINTMENT DETAILS', 24, y);
    doc.moveTo(24, y + 13).lineTo(W - 24, y + 13).lineWidth(1).strokeColor(BORDER).stroke();
    y += 22;

    const apptRows: [string, string][] = [
      ['Doctor', `${data.doctor.name} (${data.doctor.specialization})`],
      ['Department', data.appointment.department || data.doctor.department],
      ['Date', data.appointment.appointment_date],
      ['Time', data.appointment.appointment_time],
      ['Reason', data.appointment.reason || '-'],
      ['Booked By', data.bookedBy.name]
    ];
    for (const [label, value] of apptRows) {
      doc.font('Helvetica').fontSize(8).fillColor(SLATE).text(label, 24, y, { width: 110 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY_DARK).text(value, 140, y, { width: W - 164 });
      y += 16;
    }

    y += 6;

    // ---------- Payment box ----------
    const payBoxH = 96;
    doc.roundedRect(24, y, W - 48, payBoxH, 4).fillAndStroke('#fff7f2', '#f3d3c9');
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(CRIMSON).text('PAYMENT SUMMARY', 36, y + 10);

    const payInner = y + 28;
    doc.font('Helvetica').fontSize(8).fillColor(SLATE).text('Method', 36, payInner);
    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(NAVY_DARK)
      .text(PAY_LABELS[data.appointment.payment_method] || data.appointment.payment_method, 36, payInner + 11);

    doc.font('Helvetica').fontSize(8).fillColor(SLATE).text('Consultation Fee', 170, payInner);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY_DARK).text(fmtMoney(data.appointment.amount), 170, payInner + 11);

    doc.font('Helvetica').fontSize(8).fillColor(SLATE).text('Discount', 290, payInner);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY_DARK).text(fmtMoney(data.appointment.discount), 290, payInner + 11);

    doc.moveTo(36, payInner + 32).lineTo(W - 36, payInner + 32).lineWidth(0.75).strokeColor('#f3d3c9').stroke();

    doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('Amount Paid', 36, payInner + 40);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(CRIMSON).text(fmtMoney(data.appointment.paid_amount), 36, payInner + 52);

    const psColor = data.appointment.payment_status === 'paid' ? '#1f9254' : data.appointment.payment_status === 'partial' ? '#b07a0f' : CRIMSON;
    doc.font('Helvetica').fontSize(8).fillColor(SLATE).text('Payment Status', 230, payInner + 40);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(psColor)
      .text(data.appointment.payment_status.toUpperCase(), 230, payInner + 52);

    y += payBoxH + 16;

    if (data.appointment.notes) {
      doc.font('Helvetica').fontSize(7.5).fillColor(SLATE).text(`Notes: ${data.appointment.notes}`, 24, y, { width: W - 48 });
      y += 18;
    }

    // ---------- Barcode ----------
    const barcodeWidth = 220;
    doc.image(barcodePng, (W - barcodeWidth) / 2, y, { width: barcodeWidth });
    y += 70;

    // ---------- Footer ----------
    doc.moveTo(24, y).lineTo(W - 24, y).lineWidth(0.75).strokeColor(BORDER).stroke();
    y += 10;
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(SLATE)
      .text(
        'Please bring this slip to the reception on the day of your appointment. Arrive 15 minutes before your scheduled time.',
        24,
        y,
        { width: W - 48, align: 'center' }
      );
    y += 20;
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor('#9aa6ba')
      .text(`Computer generated slip - ${new Date(data.appointment.created_at).toLocaleString()}`, 24, y, {
        width: W - 48,
        align: 'center'
      });

    doc.end();
  });
}
