import PDFDocument from 'pdfkit';
import { generateBarcodePng } from './barcode';
import { formatTime12h } from './format';

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
      ['Time', formatTime12h(data.appointment.appointment_time)],
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
    y += 14;
    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor('#9aa6ba')
      .text('System powered by Krexen Technologies · www.krexen.com', 24, y, { width: W - 48, align: 'center' });

    doc.end();
  });
}

// ─── Revenue / activity report (date-range, landscape, full detail table) ──

export type ReportPdfData = {
  clinic: { name: string; address: string; phone: string; email: string };
  from: string;
  to: string;
  totals: { total_appointments: number; total_collected: number; total_billed: number };
  byPaymentMethod: { payment_method: string; count: number; collected: number }[];
  byDoctor: { doctor_name: string; count: number; collected: number }[];
  byUser: { user_name: string; count: number; collected: number }[];
  appointments: {
    appointment_no: string;
    token_number: number;
    appointment_date: string;
    appointment_time: string;
    patient_name: string;
    patient_phone: string;
    doctor_name: string;
    payment_method: string;
    amount: number;
    discount: number;
    paid_amount: number;
    payment_status: string;
    status: string;
    booked_by_name: string;
  }[];
};

export async function generateReportPdf(data: ReportPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 24 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const M = 24;

    function drawHeader() {
      doc.rect(0, 0, W, 58).fill(NAVY);
      doc.rect(0, 54, W, 4).fill(CRIMSON);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(15).text(data.clinic.name.toUpperCase(), M, 14);
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#ffd9d9')
        .text(`REVENUE & ACTIVITY REPORT   |   ${data.from} to ${data.to}`, M, 34);
    }

    drawHeader();
    let y = 74;

    // ---------- KPI summary ----------
    const kpis: [string, string][] = [
      ['Total Appointments', String(data.totals.total_appointments)],
      ['Total Collected', fmtMoney(data.totals.total_collected)],
      ['Outstanding Balance', fmtMoney(Math.max(data.totals.total_billed - data.totals.total_collected, 0))]
    ];
    const kpiW = (W - M * 2 - 16) / 3;
    kpis.forEach(([label, value], i) => {
      const x = M + i * (kpiW + 8);
      doc.roundedRect(x, y, kpiW, 46, 4).fillAndStroke(LIGHT, BORDER);
      doc.font('Helvetica').fontSize(7.5).fillColor(SLATE).text(label.toUpperCase(), x + 12, y + 9);
      doc.font('Helvetica-Bold').fontSize(15).fillColor(NAVY_DARK).text(value, x + 12, y + 22);
    });
    y += 62;

    // ---------- Payment method + doctor breakdown, side by side ----------
    const colW = (W - M * 2 - 20) / 2;
    const breakdownTop = y;

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text('BY PAYMENT METHOD', M, y);
    let py = y + 16;
    for (const r of data.byPaymentMethod) {
      doc.font('Helvetica').fontSize(8).fillColor(SLATE).text(PAY_LABELS[r.payment_method] || r.payment_method, M, py, { width: colW - 100 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY_DARK).text(`${r.count} visits — ${fmtMoney(r.collected)}`, M, py, { width: colW, align: 'right' });
      py += 14;
    }
    if (data.byPaymentMethod.length === 0) {
      doc.font('Helvetica').fontSize(8).fillColor(SLATE).text('No data for this range.', M, py);
      py += 14;
    }

    let dy = breakdownTop + 16;
    const dx = M + colW + 20;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text('BY DOCTOR', dx, breakdownTop);
    for (const r of data.byDoctor) {
      doc.font('Helvetica').fontSize(8).fillColor(SLATE).text(r.doctor_name, dx, dy, { width: colW - 140 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY_DARK).text(`${r.count} visits — ${fmtMoney(r.collected)}`, dx, dy, { width: colW, align: 'right' });
      dy += 14;
    }
    if (data.byDoctor.length === 0) {
      doc.font('Helvetica').fontSize(8).fillColor(SLATE).text('No data for this range.', dx, dy);
      dy += 14;
    }

    y = Math.max(py, dy) + 14;

    // ---------- Full appointment detail table ----------
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text(`ALL BOOKINGS (${data.appointments.length})`, M, y);
    y += 16;

    const cols: { label: string; width: number; align?: 'left' | 'right' }[] = [
      { label: 'No.', width: 90 },
      { label: 'Date', width: 56 },
      { label: 'Time', width: 46 },
      { label: 'Patient', width: 95 },
      { label: 'Phone', width: 68 },
      { label: 'Doctor', width: 90 },
      { label: 'Method', width: 52 },
      { label: 'Fee', width: 40, align: 'right' },
      { label: 'Paid', width: 44, align: 'right' },
      { label: 'Pay Status', width: 48 },
      { label: 'Status', width: 52 },
      { label: 'Booked By', width: 70 }
    ];

    function drawTableHeader() {
      doc.rect(M, y, W - M * 2, 18).fill(NAVY);
      let x = M + 6;
      doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff');
      for (const c of cols) {
        doc.text(c.label.toUpperCase(), x, y + 5, { width: c.width, align: c.align || 'left' });
        x += c.width;
      }
      y += 18;
    }

    drawTableHeader();

    doc.font('Helvetica').fontSize(7.5);
    let rowIndex = 0;
    for (const a of data.appointments) {
      if (y > H - 40) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 24 });
        drawHeader();
        y = 74;
        drawTableHeader();
        doc.font('Helvetica').fontSize(7.5);
      }
      if (rowIndex % 2 === 1) {
        doc.rect(M, y, W - M * 2, 15).fill(LIGHT);
      }
      const values = [
        a.appointment_no,
        a.appointment_date,
        formatTime12h(a.appointment_time),
        a.patient_name,
        a.patient_phone,
        a.doctor_name,
        PAY_LABELS[a.payment_method] || a.payment_method,
        fmtMoney(a.amount),
        fmtMoney(a.paid_amount),
        a.payment_status,
        a.status.replace('_', ' '),
        a.booked_by_name
      ];
      let x = M + 6;
      doc.fillColor(NAVY_DARK);
      values.forEach((v, i) => {
        const c = cols[i];
        doc.text(String(v), x, y + 4, { width: c.width, align: c.align || 'left', ellipsis: true });
        x += c.width;
      });
      y += 15;
      rowIndex++;
    }

    doc.end();
  });
}
