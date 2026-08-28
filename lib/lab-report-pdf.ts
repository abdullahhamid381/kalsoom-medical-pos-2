import PDFDocument from 'pdfkit';
import type { Db } from './db';
import { generateBarcodePng } from './barcode';
import { generateQrPng } from './qrcode';

export type LabReportItem = {
  test_name: string;
  category: string | null;
  panel_name: string | null;
  value_type: 'numeric' | 'text';
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  reference_display: string | null;
  flag: 'low' | 'normal' | 'high' | 'critical' | null;
  comment: string | null;
  culture?: { organism: string; growth_count: string | null; sensitivities: { antibiotic: string; result: string }[] }[];
};

export type LabReportData = {
  clinic: { name: string; address: string; phone: string; email: string };
  order: {
    order_no: string;
    patient_name: string;
    patient_age: number | null;
    patient_gender: string | null;
    referring_doctor: string | null;
    created_at: string;
  };
  items: LabReportItem[];
  reportedBy: string | null;
  reportedAt: string | null;
  qrUrl: string;
};

const NAVY = '#13244a';
const NAVY_DARK = '#0c1933';
const CRIMSON = '#d62828';
const SLATE = '#475467';
const BORDER = '#e3e7ef';

const FLAG_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  low: { bg: '#fef3c7', fg: '#92400e', label: 'LOW' },
  high: { bg: '#fef3c7', fg: '#92400e', label: 'HIGH' },
  critical: { bg: '#fee2e2', fg: '#b91c1c', label: 'CRITICAL' },
  normal: { bg: '#d1fae5', fg: '#065f46', label: 'NORMAL' }
};

function resultValue(item: LabReportItem): string {
  if (item.value_type === 'text') return item.value_text || '—';
  if (item.value_numeric == null) return '—';
  return `${item.value_numeric}${item.unit ? ' ' + item.unit : ''}`;
}

/** Loads everything generateLabReportPdf() needs for an order, straight from the db.
 *  Shared by the report PDF route and the report WhatsApp route so they never drift apart. */
export async function buildLabReportData(db: Db, orderId: number, baseUrl: string, clinic: LabReportData['clinic']): Promise<LabReportData | null> {
  const order = (await db.prepare(
    `SELECT lo.*, u.name AS reported_by_name FROM lab_orders lo
     LEFT JOIN users u ON u.id = lo.reported_by_user_id WHERE lo.id = ?`
  ).get(orderId)) as any;
  if (!order) return null;

  const rawItems = (await db.prepare(
    `SELECT loi.id AS order_item_id, loi.test_name, lt.category, lt.is_culture, lop.panel_name,
            lr.value_type, lr.value_numeric, lr.value_text, lr.unit, lr.reference_display, lr.flag, lr.comment
     FROM lab_order_items loi
     JOIN lab_tests lt ON lt.id = loi.test_id
     LEFT JOIN lab_order_panels lop ON lop.id = loi.order_panel_id
     LEFT JOIN lab_results lr ON lr.order_item_id = loi.id
     WHERE loi.order_id = ?
     ORDER BY loi.order_panel_id IS NULL DESC, loi.order_panel_id, loi.id`
  ).all(orderId)) as any[];

  const items: LabReportItem[] = [];
  for (const i of rawItems) {
    let culture: LabReportItem['culture'];
    if (i.is_culture) {
      const organisms = (await db.prepare(
        `SELECT co.id, co.growth_count, o.name AS organism_name FROM lab_culture_organisms co
         JOIN lab_organisms o ON o.id = co.organism_id WHERE co.order_item_id = ?`
      ).all(i.order_item_id)) as any[];
      culture = [];
      for (const org of organisms) {
        const sensitivities = (await db.prepare(
          `SELECT a.name AS antibiotic_name, cs.result FROM lab_culture_sensitivities cs
           JOIN lab_antibiotics a ON a.id = cs.antibiotic_id WHERE cs.culture_organism_id = ?`
        ).all(org.id)) as any[];
        culture.push({
          organism: org.organism_name,
          growth_count: org.growth_count,
          sensitivities: sensitivities.map((s) => ({ antibiotic: s.antibiotic_name, result: s.result }))
        });
      }
    }
    items.push({
      test_name: i.test_name,
      category: i.category,
      panel_name: i.panel_name,
      value_type: i.value_type || 'numeric',
      value_numeric: i.value_numeric,
      value_text: i.value_text,
      unit: i.unit,
      reference_display: i.reference_display,
      flag: i.flag,
      comment: i.comment,
      culture
    });
  }

  return {
    clinic,
    order: {
      order_no: order.order_no,
      patient_name: order.patient_name,
      patient_age: order.patient_age,
      patient_gender: order.patient_gender,
      referring_doctor: order.referring_doctor,
      created_at: order.created_at
    },
    items,
    reportedBy: order.reported_by_name || null,
    reportedAt: order.reported_at,
    qrUrl: order.verification_token ? `${baseUrl}/verify/lab/${order.verification_token}` : `${baseUrl}/print/lab/reports/${orderId}`
  };
}

export async function generateLabReportPdf(data: LabReportData): Promise<Buffer> {
  const barcodePng = await generateBarcodePng(data.order.order_no);
  const qrPng = await generateQrPng(data.qrUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [420, 700], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 420;
    let y = 0;

    doc.rect(0, 0, W, 90).fill(NAVY);
    doc.rect(0, 84, W, 6).fill(CRIMSON);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17).text(data.clinic.name.toUpperCase(), 24, 18, { width: W - 48 });
    doc.font('Helvetica').fontSize(8).fillColor('#cfd9ec')
      .text(data.clinic.address, 24, 40, { width: W - 48 })
      .text(`${data.clinic.phone} | ${data.clinic.email}`, 24, 52);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffd9d9').text('LABORATORY REPORT', 24, 68);

    y = 106;
    doc.roundedRect(24, y, W - 48, 40, 4).fillAndStroke('#f5f7fb', BORDER);
    doc.fillColor(SLATE).font('Helvetica').fontSize(7.5).text('REPORT NO.', 34, y + 7);
    doc.fillColor(NAVY_DARK).font('Helvetica-Bold').fontSize(11).text(data.order.order_no, 34, y + 18);
    doc.fillColor(SLATE).font('Helvetica').fontSize(7.5).text('DATE', 240, y + 7);
    doc.fillColor(NAVY_DARK).font('Helvetica-Bold').fontSize(10).text(new Date(data.order.created_at).toLocaleDateString('en-PK'), 240, y + 18);
    y += 56;

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text('PATIENT DETAILS', 24, y);
    doc.moveTo(24, y + 13).lineTo(W - 24, y + 13).lineWidth(1).strokeColor(BORDER).stroke();
    y += 22;
    const rows: [string, string][] = [
      ['Name', data.order.patient_name],
      ['Age / Gender', `${data.order.patient_age ?? '—'} yrs / ${data.order.patient_gender || '—'}`],
    ];
    if (data.order.referring_doctor) rows.push(['Referred by', `Dr. ${data.order.referring_doctor}`]);
    for (const [label, value] of rows) {
      doc.font('Helvetica').fontSize(8).fillColor(SLATE).text(label, 24, y, { width: 110 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY_DARK).text(value, 140, y, { width: W - 164 });
      y += 15;
    }
    y += 8;

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text('RESULTS', 24, y);
    doc.moveTo(24, y + 13).lineTo(W - 24, y + 13).lineWidth(1).strokeColor(BORDER).stroke();
    y += 20;

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(SLATE);
    doc.text('TEST', 24, y, { width: 110 });
    doc.text('RESULT', 136, y, { width: 80 });
    doc.text('REFERENCE', 218, y, { width: 110 });
    doc.text('FLAG', 332, y, { width: 60 });
    y += 12;
    doc.moveTo(24, y).lineTo(W - 24, y).lineWidth(0.5).strokeColor(BORDER).stroke();
    y += 6;

    let lastPanel: string | null | undefined = undefined;
    for (const item of data.items) {
      if (item.panel_name && item.panel_name !== lastPanel) {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(CRIMSON).text(item.panel_name.toUpperCase(), 24, y, { width: W - 48 });
        y += 12;
      }
      lastPanel = item.panel_name || undefined;

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY_DARK).text(item.test_name, 24, y, { width: 110 });

      if (item.culture) {
        y += 14;
        if (item.culture.length === 0) {
          doc.font('Helvetica').fontSize(8).fillColor(SLATE).text('No growth', 24, y, { width: W - 48 });
          y += 14;
        }
        for (const org of item.culture) {
          doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY_DARK).text(`${org.organism}${org.growth_count ? ` (${org.growth_count})` : ''}`, 24, y, { width: W - 48 });
          y += 12;
          for (const s of org.sensitivities) {
            const fc = FLAG_COLORS[s.result === 'S' ? 'normal' : s.result === 'R' ? 'critical' : 'low'];
            doc.font('Helvetica').fontSize(7.5).fillColor(SLATE).text(s.antibiotic, 34, y, { width: 250 });
            doc.roundedRect(300, y - 1.5, 30, 12, 3).fill(fc.bg);
            doc.font('Helvetica-Bold').fontSize(7).fillColor(fc.fg).text(s.result, 300, y + 0.5, { width: 30, align: 'center' });
            y += 12;
          }
        }
        y += 4;
      } else {
        doc.font('Helvetica').fontSize(8.5).fillColor(NAVY_DARK).text(resultValue(item), 136, y, { width: 80 });
        doc.font('Helvetica').fontSize(7.5).fillColor(SLATE).text(item.reference_display || '—', 218, y, { width: 110 });
        if (item.flag) {
          const fc = FLAG_COLORS[item.flag];
          doc.roundedRect(332, y - 2, 56, 13, 3).fill(fc.bg);
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor(fc.fg).text(fc.label, 332, y + 1.5, { width: 56, align: 'center' });
        }
        y += 15;
        if (item.comment) {
          doc.font('Helvetica').fontSize(7).fillColor(SLATE).text(`Note: ${item.comment}`, 24, y, { width: W - 48 });
          y += 12;
        }
      }
      doc.moveTo(24, y).lineTo(W - 24, y).lineWidth(0.5).strokeColor('#f3f4f6').stroke();
      y += 6;
    }

    y += 10;
    const codeY = y;
    doc.image(barcodePng, 30, codeY, { width: 170 });
    doc.image(qrPng, 260, codeY - 10, { width: 90 });
    y += 80;

    doc.moveTo(24, y).lineTo(W - 24, y).lineWidth(0.75).strokeColor(BORDER).stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY_DARK)
      .text(`Verified by: ${data.reportedBy || 'Pending verification'}`, 24, y, { width: W - 48 });
    y += 12;
    if (data.reportedAt) {
      doc.font('Helvetica').fontSize(7).fillColor(SLATE).text(`Reported on ${new Date(data.reportedAt).toLocaleString('en-PK')}`, 24, y, { width: W - 48 });
      y += 12;
    }
    doc.font('Helvetica').fontSize(6.5).fillColor('#9aa6ba')
      .text('Computer generated report. Results should be interpreted in correlation with clinical findings.', 24, y, { width: W - 48, align: 'center' });
    y += 12;
    doc.font('Helvetica').fontSize(6.5).fillColor('#9aa6ba')
      .text('System powered by Krexen Technologies · www.krexen.com', 24, y, { width: W - 48, align: 'center' });

    doc.end();
  });
}
