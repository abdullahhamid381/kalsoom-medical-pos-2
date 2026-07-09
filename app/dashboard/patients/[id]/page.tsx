'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, CalendarPlus, Printer, Download, MessageCircle, FileText } from 'lucide-react';
import { api } from '@/lib/api-client';
import StatusBadge from '@/components/StatusBadge';
import { printThermal } from '@/lib/thermal-print';

const PAY_LABELS: Record<string,string> = { cash:'Cash',jazzcash:'JazzCash',easypaisa:'EasyPaisa',bank_transfer:'Bank Transfer',card:'Card' };
const CATEGORY_STYLES: Record<string,string> = {
  appointment: 'bg-navy-100 text-navy-800', lab: 'bg-sky-100 text-sky-800', pharmacy: 'bg-emerald-100 text-emerald-800',
  admission: 'bg-teal-100 text-teal-800', surgery: 'bg-crimson-100 text-crimson-800'
};
function fmtDate(s: string) { return s ? new Date(s).toLocaleDateString('en-PK') : '—'; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgoStr(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function monthStartStr(offset = 0) { const d = new Date(); d.setMonth(d.getMonth() + offset, 1); return d.toISOString().slice(0, 10); }
function monthEndStr(offset = 0) { const d = new Date(); d.setMonth(d.getMonth() + offset + 1, 0); return d.toISOString().slice(0, 10); }
function yearStartStr() { const d = new Date(); return `${d.getFullYear()}-01-01`; }

function exportLedgerCSV(timeline: any[], patientName: string, from: string, to: string) {
  const headers = ['Date','Category','Reference No','Description','Doctor','Billed','Discount','Paid','Outstanding','Payment Status','Status'];
  const rows = timeline.map((e: any) => [
    e.date, e.categoryLabel, e.no, e.description, e.doctor || '', e.billed, e.discount, e.paid, e.outstanding, e.paymentStatus, e.status || ''
  ]);
  const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `${patientName.replace(/\s+/g,'_')}-statement-${from || 'all'}-to-${to || 'time'}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function SectionHeader({ title, count, total }: { title: string; count: number; total: number }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-mist/40">
      <h3 className="font-display font-semibold text-navy-900 flex items-center gap-2">{title}<span className="kmc-badge bg-navy-100 text-navy-700">{count}</span></h3>
      {total>0&&<span className="text-xs font-mono-num text-gray-500">Paid: <span className="font-bold text-navy-900">Rs.{total.toLocaleString()}</span></span>}
    </div>
  );
}

export default function PatientFilePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'timeline'|'appointments'|'lab'|'pharmacy'|'admissions'|'surgery'>('timeline');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    const qs = from && to ? `?from=${from}&to=${to}` : '';
    api.get(`/api/patients/${id}/file${qs}`).then(d=>setData(d)).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  }, [id, from, to]);

  function quickRange(f: string, t: string) { setFrom(f); setTo(t); }
  function clearRange() { setFrom(''); setTo(''); }

  const statementQs = from && to ? `?from=${from}&to=${to}` : '';

  async function handleWhatsApp() {
    if (!data) return;
    setSending(true);
    try {
      const res = await api.post(`/api/patients/${id}/file/whatsapp${statementQs}`);
      if (res.shareLink) window.open(res.shareLink, '_blank');
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  }

  function handlePrintFile() {
    if (!data) return;
    const { patient, summary } = data;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px}h2{font-size:13px;border-bottom:2px solid #13244a;padding-bottom:3px;margin-top:16px;color:#13244a}table{width:100%;border-collapse:collapse;margin-top:6px}th{text-align:left;border-bottom:2px solid #13244a;padding:5px;font-size:10px;color:#13244a;text-transform:uppercase}td{padding:5px;border-bottom:1px solid #eee;font-size:11px}.row{display:flex;justify-content:space-between;gap:8px}.box{flex:1;background:#f9fafb;padding:8px;border-radius:6px;text-align:center}.label{font-size:10px;color:#6b7280}.val{font-weight:700;font-size:13px}</style></head><body>
    <div class="row"><div><p style="font-size:18px;font-weight:700;margin:0">${patient.full_name}</p><p style="margin:2px 0;color:#666">${patient.phone||'—'} | ${patient.gender||'—'} | Age: ${patient.age||'—'}</p>${patient.cnic?`<p style="color:#666;margin:2px 0">CNIC: ${patient.cnic}</p>`:''}</div><div style="text-align:right"><p style="font-weight:700;font-size:15px;margin:0">PATIENT FILE</p><p style="color:#666;margin:2px 0">Generated: ${new Date().toLocaleDateString('en-PK')}</p></div></div>
    <hr style="margin:8px 0">
    <div class="row">${[['Total Billed',summary.totalBilled],['Discount',summary.totalDiscount],['Total Paid',summary.totalPaid],['Outstanding',summary.totalOutstanding]].map(([l,t])=>`<div class="box"><div class="label">${l}</div><div class="val" style="color:${l==='Outstanding'&&Number(t)>0?'#d62828':'#059669'}">Rs.${Number(t).toLocaleString()}</div></div>`).join('')}</div>
    ${data.appointments?.length?`<h2>Appointments (${data.appointments.length})</h2><table><tr><th>Date</th><th>No</th><th>Doctor</th><th>Reason</th><th>Fee</th><th>Paid</th><th>Status</th></tr>${data.appointments.map((a:any)=>`<tr><td>${a.appointment_date}</td><td>${a.appointment_no}</td><td>Dr.${a.doctor_name}</td><td>${a.reason||'—'}</td><td>Rs.${a.amount}</td><td>Rs.${a.paid_amount}</td><td>${a.status}</td></tr>`).join('')}</table>`:''}
    ${data.labOrders?.length?`<h2>Lab Orders (${data.labOrders.length})</h2><table><tr><th>Date</th><th>Order No</th><th>Total</th><th>Paid</th><th>Status</th></tr>${data.labOrders.map((o:any)=>`<tr><td>${fmtDate(o.created_at)}</td><td>${o.order_no}</td><td>Rs.${o.total}</td><td>Rs.${o.paid_amount}</td><td>${o.payment_status}</td></tr>`).join('')}</table>`:''}
    ${data.pharmacySales?.length?`<h2>Pharmacy Sales (${data.pharmacySales.length})</h2><table><tr><th>Date</th><th>Sale No</th><th>Total</th><th>Paid</th><th>Method</th></tr>${data.pharmacySales.map((s:any)=>`<tr><td>${fmtDate(s.created_at)}</td><td>${s.sale_no}</td><td>Rs.${s.total}</td><td>Rs.${s.paid_amount}</td><td>${PAY_LABELS[s.payment_method]||s.payment_method}</td></tr>`).join('')}</table>`:''}
    ${data.admissions?.length?`<h2>Admissions (${data.admissions.length})</h2><table><tr><th>Admitted</th><th>No</th><th>Room</th><th>Days</th><th>Total</th><th>Paid</th><th>Status</th></tr>${data.admissions.map((a:any)=>`<tr><td>${a.admission_date}</td><td>${a.admission_no}</td><td>${a.room_no} (${a.room_type})</td><td>${a.days_stayed||'—'}</td><td>Rs.${a.grand_total}</td><td>Rs.${a.paid_amount}</td><td>${a.status}</td></tr>`).join('')}</table>`:''}
    ${data.surgeries?.length?`<h2>Surgeries (${data.surgeries.length})</h2><table><tr><th>Date</th><th>No</th><th>Surgery</th><th>Surgeon</th><th>Total</th><th>Paid</th><th>Status</th></tr>${data.surgeries.map((s:any)=>`<tr><td>${s.surgery_date}</td><td>${s.surgery_no}</td><td>${s.surgery_name}</td><td>${s.surgeon_name?`Dr.${s.surgeon_name}`:'—'}</td><td>Rs.${s.total_cost}</td><td>Rs.${s.paid_amount}</td><td>${s.status}</td></tr>`).join('')}</table>`:''}
    </body></html>`;
    printThermal(html);
  }

  if (loading && !data) return <div className="text-center text-gray-400 py-16">Loading patient file...</div>;
  if (error && !data) return <div className="kmc-card p-5 border-crimson-200 bg-crimson-50 text-crimson-700">{error}</div>;
  if (!data) return null;
  const { patient, summary, timeline } = data;

  const TABS = [
    { key:'timeline',label:`Timeline (${summary.totalRecords})` },
    { key:'appointments',label:`Appointments (${summary.totalAppointments})` },
    { key:'lab',label:`Lab (${summary.totalLabOrders})` },
    { key:'pharmacy',label:`Pharmacy (${summary.totalPharmacySales})` },
    { key:'admissions',label:`Admissions (${summary.totalAdmissions})` },
    { key:'surgery',label:`Surgery (${summary.totalSurgeries})` },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <button onClick={()=>router.push('/dashboard/patients')} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5"><ArrowLeft size={15}/>Back</button>
      <div className="kmc-card p-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">{patient.full_name}</h1>
          <p className="text-sm text-gray-500 font-mono-num flex items-center gap-1.5 mt-1"><Phone size={13}/>{patient.phone||'—'}</p>
          <p className="text-xs text-gray-400 mt-1">{patient.gender}{patient.age?` · ${patient.age}yrs`:''}{patient.cnic?` · CNIC: ${patient.cnic}`:''}</p>
          {patient.address&&<p className="text-xs text-gray-400">{patient.address}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>exportLedgerCSV(timeline, patient.full_name, from, to)} disabled={!timeline.length} className="kmc-btn-ghost flex items-center gap-2 text-sm"><Download size={15}/>CSV</button>
          <a href={`/api/patients/${id}/file/pdf${statementQs}`} target="_blank" rel="noreferrer" className="kmc-btn-ghost flex items-center gap-2 text-sm"><FileText size={15}/>Statement PDF</a>
          <button onClick={handleWhatsApp} disabled={sending || !patient.phone} className="kmc-btn-accent flex items-center gap-2 text-sm"><MessageCircle size={15}/>{sending?'Sending...':'WhatsApp'}</button>
          <button onClick={handlePrintFile} className="kmc-btn-ghost flex items-center gap-2 text-sm"><Printer size={15}/>Print File</button>
          <a href="/dashboard/appointments/new" className="kmc-btn-primary flex items-center gap-2 text-sm"><CalendarPlus size={15}/>Book Appointment</a>
        </div>
      </div>

      {/* Date range filter */}
      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <input type="date" className="kmc-input max-w-[160px]" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" className="kmc-input max-w-[160px]" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex gap-2 ml-auto flex-wrap">
          <button onClick={clearRange} className={`kmc-btn-ghost text-xs px-3 py-1.5 ${!from&&!to?'bg-navy-100 text-navy-800':''}`}>All Time</button>
          <button onClick={()=>quickRange(daysAgoStr(29), todayStr())} className="kmc-btn-ghost text-xs px-3 py-1.5">30 Days</button>
          <button onClick={()=>quickRange(monthStartStr(0), monthEndStr(0))} className="kmc-btn-ghost text-xs px-3 py-1.5">This Month</button>
          <button onClick={()=>quickRange(monthStartStr(-1), monthEndStr(-1))} className="kmc-btn-ghost text-xs px-3 py-1.5">Last Month</button>
          <button onClick={()=>quickRange(yearStartStr(), todayStr())} className="kmc-btn-ghost text-xs px-3 py-1.5">This Year</button>
        </div>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {/* Expense summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[['Total Billed',summary.totalBilled,false],['Discount',summary.totalDiscount,false],['Total Paid',summary.totalPaid,false],['Outstanding',summary.totalOutstanding,true]].map(([l,v,warn])=>(
          <div key={l as string} className={`kmc-card p-4 text-center ${warn&&Number(v)>0?'bg-crimson-50 border-crimson-200':''}`}>
            <p className="text-[10px] mb-1 text-gray-400">{l}</p>
            <p className={`font-mono-num font-bold ${warn&&Number(v)>0?'text-crimson-700':'text-navy-900'}`}>Rs.{Number(v).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {[['Appointments',summary.categories.appointment],['Lab',summary.categories.lab],['Pharmacy',summary.categories.pharmacy],['Admissions',summary.categories.admission],['Surgery',summary.categories.surgery]].map(([l,c]:any)=>(
          <div key={l as string} className="kmc-card p-3 text-center">
            <p className="text-[10px] mb-1 text-gray-400">{l}</p>
            <p className="font-mono-num font-bold text-navy-900 text-sm">Rs.{Number(c.paid).toLocaleString()}</p>
            {c.outstanding>0&&<p className="font-mono-num text-[10px] text-crimson-600 mt-0.5">Due Rs.{Number(c.outstanding).toLocaleString()}</p>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as any)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg ${tab===t.key?'bg-white border border-b-white border-gray-200 text-navy-900 -mb-px':'text-gray-500 hover:text-navy-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab==='timeline'&&(
        <div className="kmc-card">
          <SectionHeader title="Unified Expense Timeline" count={summary.totalRecords} total={summary.totalPaid}/>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">{['Date','Category','Reference','Doctor','Billed','Discount','Paid','Outstanding','Status'].map(h=><th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{timeline.map((e:any)=>(
            <tr key={`${e.category}-${e.id}`} className="border-b border-gray-50 last:border-0 hover:bg-mist/50 cursor-pointer" onClick={()=>window.open(e.link,'_blank')}>
              <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{e.date}</td>
              <td className="px-4 py-2.5"><span className={`kmc-badge ${CATEGORY_STYLES[e.category]||'bg-gray-100 text-gray-700'}`}>{e.categoryLabel}</span></td>
              <td className="px-4 py-2.5"><span className="font-mono-num text-navy-800">{e.no}</span><br/><span className="text-xs text-gray-400">{e.description}</span></td>
              <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{e.doctor?`Dr.${e.doctor}`:'—'}</td>
              <td className="px-4 py-2.5 font-mono-num">Rs.{e.billed.toLocaleString()}</td>
              <td className="px-4 py-2.5 font-mono-num text-gray-500">Rs.{e.discount.toLocaleString()}</td>
              <td className="px-4 py-2.5 font-mono-num text-emerald-700">Rs.{e.paid.toLocaleString()}</td>
              <td className="px-4 py-2.5 font-mono-num">{e.outstanding>0?<span className="text-crimson-700 font-semibold">Rs.{e.outstanding.toLocaleString()}</span>:<span className="text-gray-300">—</span>}</td>
              <td className="px-4 py-2.5"><StatusBadge value={e.paymentStatus}/></td>
            </tr>
          ))}</tbody></table></div>
          {timeline.length===0&&<div className="p-8 text-center text-gray-400">No records found for this period.</div>}
        </div>
      )}
      {tab==='appointments'&&data.appointments?.length>0&&(
        <div className="kmc-card"><SectionHeader title="Appointments" count={summary.totalAppointments} total={summary.appointmentTotal}/>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">{['No','Date','Doctor','Reason','Fee','Paid','Payment','Status'].map(h=><th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{data.appointments.map((a:any)=>(
            <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/50 cursor-pointer" onClick={()=>window.open(`/dashboard/appointments/${a.id}`,'_blank')}>
              <td className="px-4 py-2.5 font-mono-num text-navy-800">{a.appointment_no}</td><td className="px-4 py-2.5 text-gray-600">{a.appointment_date}</td>
              <td className="px-4 py-2.5 text-gray-700">Dr.{a.doctor_name}</td><td className="px-4 py-2.5 text-gray-400 text-xs">{a.reason||'—'}</td>
              <td className="px-4 py-2.5 font-mono-num">Rs.{a.amount}</td><td className="px-4 py-2.5 font-mono-num text-emerald-700">Rs.{a.paid_amount}</td>
              <td className="px-4 py-2.5"><StatusBadge value={a.payment_status}/></td><td className="px-4 py-2.5"><StatusBadge value={a.status}/></td>
            </tr>
          ))}</tbody></table></div>
        </div>
      )}
      {tab==='lab'&&data.labOrders?.length>0&&(
        <div className="kmc-card"><SectionHeader title="Lab Orders" count={summary.totalLabOrders} total={summary.labTotal}/>
          <div className="px-5 py-2 border-b border-gray-100 bg-white text-right">
            <Link href={`/dashboard/patients/${id}/lab-history`} className="text-xs font-semibold text-navy-700 hover:text-crimson-600">View Full Lab History &rarr;</Link>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">{['Order No','Date','Total','Paid','Pay Status','Status'].map(h=><th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{data.labOrders.map((o:any)=>(<tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/50 cursor-pointer" onClick={()=>window.open(`/dashboard/lab/orders/${o.id}`,'_blank')}>
            <td className="px-4 py-2.5 font-mono-num text-navy-800">{o.order_no}</td><td className="px-4 py-2.5 text-gray-600">{fmtDate(o.created_at)}</td>
            <td className="px-4 py-2.5 font-mono-num font-semibold">Rs.{o.total}</td><td className="px-4 py-2.5 font-mono-num text-emerald-700">Rs.{o.paid_amount}</td>
            <td className="px-4 py-2.5"><StatusBadge value={o.payment_status}/></td><td className="px-4 py-2.5"><span className="kmc-badge bg-sky-100 text-sky-800">{o.status}</span></td>
          </tr>))}</tbody></table></div>
        </div>
      )}
      {tab==='pharmacy'&&data.pharmacySales?.length>0&&(
        <div className="kmc-card"><SectionHeader title="Pharmacy Sales" count={summary.totalPharmacySales} total={summary.pharmacyTotal}/>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">{['Sale No','Date','Total','Paid','Method','Status'].map(h=><th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{data.pharmacySales.map((s:any)=>(<tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/50 cursor-pointer" onClick={()=>window.open(`/dashboard/pharmacy/sales/${s.id}`,'_blank')}>
            <td className="px-4 py-2.5 font-mono-num text-navy-800">{s.sale_no}</td><td className="px-4 py-2.5 text-gray-600">{fmtDate(s.created_at)}</td>
            <td className="px-4 py-2.5 font-mono-num font-semibold">Rs.{s.total}</td><td className="px-4 py-2.5 font-mono-num text-emerald-700">Rs.{s.paid_amount}</td>
            <td className="px-4 py-2.5 text-gray-500 text-xs">{PAY_LABELS[s.payment_method]||s.payment_method}</td><td className="px-4 py-2.5"><StatusBadge value={s.payment_status}/></td>
          </tr>))}</tbody></table></div>
        </div>
      )}
      {tab==='admissions'&&data.admissions?.length>0&&(
        <div className="kmc-card"><SectionHeader title="Admissions / IPD" count={summary.totalAdmissions} total={summary.admissionTotal}/>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">{['Adm No','Admitted','Discharged','Room','Days','Total','Paid','Status'].map(h=><th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{data.admissions.map((a:any)=>(<tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/50 cursor-pointer" onClick={()=>window.open(`/dashboard/ipd/admissions/${a.id}`,'_blank')}>
            <td className="px-4 py-2.5 font-mono-num text-navy-800">{a.admission_no}</td><td className="px-4 py-2.5 text-gray-600">{a.admission_date}</td>
            <td className="px-4 py-2.5 text-gray-500">{a.discharge_date||'—'}</td><td className="px-4 py-2.5 font-mono-num">{a.room_no}</td>
            <td className="px-4 py-2.5 font-mono-num">{a.days_stayed||'—'}</td><td className="px-4 py-2.5 font-mono-num font-semibold">Rs.{a.grand_total}</td>
            <td className="px-4 py-2.5 font-mono-num text-emerald-700">Rs.{a.paid_amount}</td>
            <td className="px-4 py-2.5"><span className={`kmc-badge ${a.status==='admitted'?'bg-teal-100 text-teal-800':'bg-gray-100 text-gray-600'}`}>{a.status}</span></td>
          </tr>))}</tbody></table></div>
        </div>
      )}
      {tab==='surgery'&&data.surgeries?.length>0&&(
        <div className="kmc-card"><SectionHeader title="Surgeries" count={summary.totalSurgeries} total={summary.surgeryTotal}/>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">{['Surgery No','Date','Surgery','Surgeon','Total','Paid','Status'].map(h=><th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{data.surgeries.map((s:any)=>(<tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/50 cursor-pointer" onClick={()=>window.open(`/dashboard/surgery/records/${s.id}`,'_blank')}>
            <td className="px-4 py-2.5 font-mono-num text-navy-800">{s.surgery_no}</td><td className="px-4 py-2.5 text-gray-600">{s.surgery_date}</td>
            <td className="px-4 py-2.5 text-gray-700">{s.surgery_name}</td><td className="px-4 py-2.5 text-gray-500 text-xs">{s.surgeon_name?`Dr.${s.surgeon_name}`:'—'}</td>
            <td className="px-4 py-2.5 font-mono-num font-semibold">Rs.{s.total_cost}</td><td className="px-4 py-2.5 font-mono-num text-emerald-700">Rs.{s.paid_amount}</td>
            <td className="px-4 py-2.5"><span className={`kmc-badge ${s.status==='completed'?'bg-emerald-100 text-emerald-800':s.status==='scheduled'?'bg-amber-100 text-amber-800':'bg-gray-200 text-gray-600'}`}>{s.status}</span></td>
          </tr>))}</tbody></table></div>
        </div>
      )}
      {tab!=='timeline'&&(data[tab==='appointments'?'appointments':tab==='lab'?'labOrders':tab==='pharmacy'?'pharmacySales':tab==='admissions'?'admissions':'surgeries']?.length??0)===0&&(
        <div className="kmc-card p-8 text-center text-gray-400">No records found for this period.</div>
      )}
    </div>
  );
}
