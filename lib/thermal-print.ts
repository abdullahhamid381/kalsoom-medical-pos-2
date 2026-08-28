import { formatTime12h } from './format';

/**
 * Prints a self-contained HTML string on a hidden iframe.
 * The user sees zero navigation — the print dialog appears directly.
 */
export function printThermal(html: string): void {
  // Remove any previous thermal iframe
  const old = document.getElementById('__thermal_print_frame');
  if (old) old.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__thermal_print_frame';
  iframe.style.cssText = [
    'position:fixed',
    'top:-9999px',
    'left:-9999px',
    'width:80mm',
    'height:1px',
    'border:none',
    'visibility:hidden',
    'pointer-events:none'
  ].join(';');

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for images/fonts inside the iframe to load before printing
  const win = iframe.contentWindow;
  if (!win) { iframe.remove(); return; }

  win.onload = () => {
    win.focus();
    win.print();
    // Clean up after the print dialog is dismissed
    setTimeout(() => iframe.remove(), 2000);
  };

  // Fallback: if onload doesn't fire (no images) trigger after a tick
  setTimeout(() => {
    try { if (win.document.readyState === 'complete') { win.focus(); win.print(); setTimeout(() => iframe.remove(), 2000); } }
    catch { /* already handled */ }
  }, 300);
}

// ─── Receipt HTML builders ────────────────────────────────────────────────────

const FONT = `'Courier New', Courier, monospace`;
const BASE_STYLE = `
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 80mm; max-width: 80mm; font-family: ${FONT}; font-size: 11px; color: #111; line-height: 1.5; padding: 4mm; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .row { display: flex; justify-content: space-between; }
  .dash { border-top: 1px dashed #000; margin: 4px 0; }
  .small { font-size: 9.5px; }
  .title { font-size: 13px; font-weight: 700; }
  img.barcode { display: block; max-width: 100%; height: 42px; margin: 4px auto; }
`;

interface ClinicInfo { name: string; address: string; phone: string; }

const POWERED_BY = `
  <div class="dash"></div>
  <div class="center small" style="opacity:.65">System powered by Krexen Technologies</div>
  <div class="center small" style="opacity:.65">www.krexen.com</div>`;

export function appointmentReceiptHtml(appt: any, clinic: ClinicInfo, barcodeDataUrl?: string): string {
  const PAY: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
  <div class="center">
    <div class="title">${esc(clinic.name)}</div>
    <div class="small">APPOINTMENT SLIP</div>
    <div class="small">${esc(clinic.address)}</div>
    <div class="small">${esc(clinic.phone)}</div>
  </div>
  <div class="dash"></div>
  <div class="row"><span>${esc(appt.appointment_no)}</span><span class="bold">Token #${appt.token_number}</span></div>
  <div class="dash"></div>
  <div><span class="bold">Patient:</span> ${esc(appt.patient_name)}</div>
  <div><span class="bold">Phone:</span> ${esc(appt.patient_phone || '—')}</div>
  ${appt.patient_age || appt.patient_gender ? `<div><span class="bold">Age/Gender:</span> ${appt.patient_age || '—'} / ${esc(appt.patient_gender || '—')}</div>` : ''}
  <div class="dash"></div>
  <div><span class="bold">Doctor:</span> ${esc(appt.doctor_name)}</div>
  <div><span class="bold">Dept:</span> ${esc(appt.department || appt.doctor_department || '—')}</div>
  <div><span class="bold">Date:</span> ${esc(appt.appointment_date)}</div>
  <div><span class="bold">Time:</span> ${esc(formatTime12h(appt.appointment_time))}</div>
  ${appt.reason ? `<div><span class="bold">Reason:</span> ${esc(appt.reason)}</div>` : ''}
  <div class="dash"></div>
  <div class="row"><span>Method</span><span>${esc(PAY[appt.payment_method] || appt.payment_method)}</span></div>
  <div class="row"><span>Fee</span><span>Rs. ${appt.amount}</span></div>
  ${appt.discount > 0 ? `<div class="row"><span>Discount</span><span>Rs. ${appt.discount}</span></div>` : ''}
  <div class="row bold"><span>Net Payable</span><span>Rs. ${appt.amount - appt.discount}</span></div>
  <div class="row bold"><span>Paid (${esc(appt.payment_status.toUpperCase())})</span><span>Rs. ${appt.paid_amount}</span></div>
  <div class="dash"></div>
  ${barcodeDataUrl ? `<img class="barcode" src="${barcodeDataUrl}" alt="barcode"/>` : ''}
  <div class="center small">Arrive 15 min early · Booked by ${esc(appt.booked_by_name)}</div>
  ${POWERED_BY}
  </body></html>`;
}

export function pharmacyReceiptHtml(sale: any, clinic: ClinicInfo, barcodeDataUrl?: string): string {
  const PAY: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };
  const itemRows = (sale.items || []).map((i: any) =>
    `<div style="padding-left:6px"><div class="row"><span>${esc(i.medicine_name)}</span><span>Rs. ${i.total}</span></div>
     <div class="small" style="padding-left:8px">${i.qty} ${esc(i.unit)} × Rs. ${i.unit_price}</div></div>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
  <div class="center">
    <div class="title">${esc(clinic.name)}</div>
    <div class="small">PHARMACY RECEIPT</div>
    <div class="small">${esc(clinic.address)}</div>
    <div class="small">${esc(clinic.phone)}</div>
  </div>
  <div class="dash"></div>
  <div class="row"><span>${esc(sale.sale_no)}</span><span>${new Date(sale.created_at).toLocaleDateString('en-PK')}</span></div>
  <div><span class="bold">Patient:</span> ${esc(sale.patient_name)}</div>
  ${sale.patient_phone ? `<div><span class="bold">Phone:</span> ${esc(sale.patient_phone)}</div>` : ''}
  <div class="dash"></div>
  <div class="bold" style="margin-bottom:2px">MEDICINES:</div>
  ${itemRows}
  <div class="dash"></div>
  <div class="row"><span>Subtotal</span><span>Rs. ${sale.subtotal}</span></div>
  ${sale.discount > 0 ? `<div class="row"><span>Discount</span><span>Rs. ${sale.discount}</span></div>` : ''}
  <div class="row bold"><span>TOTAL</span><span>Rs. ${sale.total}</span></div>
  <div class="row"><span>Paid (${esc(PAY[sale.payment_method] || sale.payment_method)})</span><span>Rs. ${sale.paid_amount}</span></div>
  ${sale.total - sale.paid_amount > 0 ? `<div class="row bold"><span>Balance Due</span><span>Rs. ${sale.total - sale.paid_amount}</span></div>` : ''}
  <div class="dash"></div>
  ${barcodeDataUrl ? `<img class="barcode" src="${barcodeDataUrl}" alt="barcode"/>` : ''}
  <div class="center small">${esc(sale.payment_status.toUpperCase())} · Served by ${esc(sale.sold_by_name)}</div>
  <div class="center small">Thank you for visiting ${esc(clinic.name)}!</div>
  ${POWERED_BY}
  </body></html>`;
}

export function labReceiptHtml(order: any, clinic: ClinicInfo, barcodeDataUrl?: string): string {
  const PAY: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };
  const testRows = (order.items || []).map((i: any) =>
    `<div class="row"><span>${esc(i.test_name)}</span><span>Rs. ${i.price}</span></div>`
  ).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
  <div class="center">
    <div class="title">${esc(clinic.name)}</div>
    <div class="small">LABORATORY RECEIPT</div>
    <div class="small">${esc(clinic.address)}</div>
    <div class="small">${esc(clinic.phone)}</div>
  </div>
  <div class="dash"></div>
  <div class="row"><span>${esc(order.order_no)}</span><span>${new Date(order.created_at).toLocaleDateString('en-PK')}</span></div>
  <div class="dash"></div>
  <div><span class="bold">Patient:</span> ${esc(order.patient_name)}</div>
  ${order.patient_phone ? `<div><span class="bold">Phone:</span> ${esc(order.patient_phone)}</div>` : ''}
  ${order.patient_age || order.patient_gender ? `<div><span class="bold">Age/Gender:</span> ${order.patient_age || '—'} / ${esc(order.patient_gender || '—')}</div>` : ''}
  ${order.referring_doctor ? `<div><span class="bold">Referred by:</span> Dr. ${esc(order.referring_doctor)}</div>` : ''}
  <div class="dash"></div>
  <div class="bold" style="margin-bottom:2px">TESTS ORDERED:</div>
  ${testRows}
  <div class="dash"></div>
  ${order.discount > 0 ? `<div class="row"><span>Discount</span><span>Rs. ${order.discount}</span></div>` : ''}
  <div class="row bold"><span>TOTAL</span><span>Rs. ${order.total}</span></div>
  <div class="row"><span>Paid (${esc(PAY[order.payment_method] || order.payment_method)})</span><span>Rs. ${order.paid_amount}</span></div>
  ${order.total - order.paid_amount > 0 ? `<div class="row bold"><span>Balance Due</span><span>Rs. ${order.total - order.paid_amount}</span></div>` : ''}
  <div class="dash"></div>
  <div class="center small">Status: ${esc(order.status.toUpperCase())}</div>
  ${barcodeDataUrl ? `<img class="barcode" src="${barcodeDataUrl}" alt="barcode"/>` : ''}
  <div class="center small">${esc(order.order_no)}</div>
  <div class="center small">Present receipt to collect reports.</div>
  <div class="center small">Booked by ${esc(order.booked_by_name)}</div>
  ${POWERED_BY}
  </body></html>`;
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function admissionReceiptHtml(admission: any, charges: any[], clinic: ClinicInfo): string {
  const PAY: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };
  const CHARGE_LABELS: Record<string,string> = { room:'Room', medicine:'Medicine', lab:'Lab Test', procedure:'Procedure', doctor_fee:'Doctor Fee', nursing:'Nursing', other:'Other' };
  const grouped: Record<string, any[]> = {};
  for (const c of charges) {
    if (!grouped[c.charge_type]) grouped[c.charge_type] = [];
    grouped[c.charge_type].push(c);
  }
  const sections = Object.entries(grouped).map(([type, items]) => {
    const rows = items.map((i: any) => `<div class="row"><span style="max-width:55%">${esc(i.description)}</span><span>Rs. ${i.total}</span></div>`).join('');
    const sub = items.reduce((s: number, i: any) => s + i.total, 0);
    return `<div class="bold" style="margin-top:4px">${CHARGE_LABELS[type] || type}:</div>${rows}<div class="row small"><span>Subtotal</span><span>Rs. ${sub}</span></div>`;
  }).join('<div style="border-top:1px dotted #ccc;margin:3px 0"></div>');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
  <div class="center">
    <div class="title">${esc(clinic.name)}</div>
    <div class="small">IN-PATIENT BILL</div>
    <div class="small">${esc(clinic.address)}</div>
    <div class="small">${esc(clinic.phone)}</div>
  </div>
  <div class="dash"></div>
  <div class="row"><span>${esc(admission.admission_no)}</span><span class="small">${esc(admission.status.toUpperCase())}</span></div>
  <div class="dash"></div>
  <div><span class="bold">Patient:</span> ${esc(admission.patient_name)}</div>
  ${admission.patient_phone ? `<div><span class="bold">Phone:</span> ${esc(admission.patient_phone)}</div>` : ''}
  <div><span class="bold">Room:</span> ${esc(admission.room_no)} (${esc(admission.room_type?.replace('_',' '))})</div>
  ${admission.doctor_name ? `<div><span class="bold">Doctor:</span> Dr. ${esc(admission.doctor_name)}</div>` : ''}
  <div><span class="bold">Admitted:</span> ${esc(admission.admission_date)} ${esc(admission.admission_time)}</div>
  ${admission.discharge_date ? `<div><span class="bold">Discharged:</span> ${esc(admission.discharge_date)}</div>` : ''}
  <div><span class="bold">Days Stayed:</span> ${admission.days_stayed || '—'}</div>
  <div class="dash"></div>
  <div class="bold" style="margin-bottom:3px">CHARGES BREAKDOWN:</div>
  ${sections}
  <div class="dash"></div>
  <div class="row bold"><span>Grand Total</span><span>Rs. ${admission.grand_total}</span></div>
  ${admission.discount > 0 ? `<div class="row"><span>Discount</span><span>Rs. ${admission.discount}</span></div>` : ''}
  <div class="row bold"><span>Net Payable</span><span>Rs. ${admission.grand_total - admission.discount}</span></div>
  <div class="row"><span>Paid ${admission.payment_method ? `(${PAY[admission.payment_method] || admission.payment_method})` : ''}</span><span>Rs. ${admission.paid_amount}</span></div>
  ${admission.grand_total - admission.discount - admission.paid_amount > 0 ? `<div class="row bold"><span>Balance Due</span><span>Rs. ${admission.grand_total - admission.discount - admission.paid_amount}</span></div>` : ''}
  <div class="dash"></div>
  <div class="center small">${esc(admission.payment_status?.toUpperCase())} · Generated ${new Date().toLocaleDateString('en-PK')}</div>
  <div class="center small">Thank you for choosing ${esc(clinic.name)}</div>
  ${POWERED_BY}
  </body></html>`;
}

export function surgeryReceiptHtml(rec: any, clinic: ClinicInfo, barcodeDataUrl?: string): string {
  const PAY: Record<string,string> = { cash:'Cash',jazzcash:'JazzCash',easypaisa:'EasyPaisa',bank_transfer:'Bank Transfer',card:'Card' };
  const balance = Math.max(rec.total_cost - rec.discount - rec.paid_amount, 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body>
  <div class="center"><div class="title">${esc(clinic.name)}</div><div class="small">SURGERY RECEIPT</div><div class="small">${esc(clinic.address)}</div><div class="small">${esc(clinic.phone)}</div></div>
  <div class="dash"></div>
  <div class="row"><span class="bold">${esc(rec.surgery_no)}</span><span>${esc(rec.status?.toUpperCase())}</span></div>
  <div class="dash"></div>
  <div><span class="bold">Patient:</span> ${esc(rec.patient_name)}</div>
  ${rec.patient_phone?`<div><span class="bold">Phone:</span> ${esc(rec.patient_phone)}</div>`:''}
  ${(rec.patient_age||rec.patient_gender)?`<div><span class="bold">Age/Gender:</span> ${rec.patient_age||'—'} / ${esc(rec.patient_gender||'—')}</div>`:''}
  <div><span class="bold">Surgery:</span> ${esc(rec.surgery_name)}</div>
  ${rec.surgeon_name?`<div><span class="bold">Surgeon:</span> Dr. ${esc(rec.surgeon_name)}</div>`:''}
  ${rec.anesthetist?`<div><span class="bold">Anesthetist:</span> ${esc(rec.anesthetist)}</div>`:''}
  <div><span class="bold">Date:</span> ${esc(rec.surgery_date)}${rec.surgery_time?` at ${esc(rec.surgery_time)}`:''}</div>
  ${rec.theatre_no?`<div><span class="bold">Theatre:</span> ${esc(rec.theatre_no)}</div>`:''}
  ${rec.diagnosis?`<div><span class="bold">Dx:</span> ${esc(rec.diagnosis)}</div>`:''}
  <div class="dash"></div>
  <div class="row"><span>Surgeon Fee</span><span>Rs. ${rec.surgery_fee}</span></div>
  <div class="row"><span>Anaesthesia</span><span>Rs. ${rec.anesthesia_fee}</span></div>
  <div class="row"><span>Theatre</span><span>Rs. ${rec.theatre_fee}</span></div>
  ${rec.medicine_cost>0?`<div class="row"><span>Medicines</span><span>Rs. ${rec.medicine_cost}</span></div>`:''}
  ${rec.other_charges>0?`<div class="row"><span>Other</span><span>Rs. ${rec.other_charges}</span></div>`:''}
  <div class="dash"></div>
  <div class="row bold"><span>TOTAL</span><span>Rs. ${rec.total_cost}</span></div>
  ${rec.discount>0?`<div class="row"><span>Discount</span><span>Rs. ${rec.discount}</span></div>`:''}
  <div class="row"><span>Paid${rec.payment_method?` (${PAY[rec.payment_method]||rec.payment_method})`:''}</span><span>Rs. ${rec.paid_amount}</span></div>
  ${balance>0?`<div class="row bold"><span>Balance Due</span><span>Rs. ${balance}</span></div>`:''}
  <div class="dash"></div>
  ${barcodeDataUrl?`<img class="barcode" src="${barcodeDataUrl}" alt="barcode"/>`:''}
  <div class="center small">${esc(rec.surgery_no)} · ${esc(rec.payment_status?.toUpperCase())}</div>
  <div class="center small">Thank you for choosing ${esc(clinic.name)}</div>
  ${POWERED_BY}
  </body></html>`;
}
