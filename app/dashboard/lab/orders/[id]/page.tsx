'use client';
import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, MessageCircle, CheckCircle2, Trash2, Pencil, Download, FileText, FlaskConical } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { printThermal, labReceiptHtml } from '@/lib/thermal-print';

const SAMPLE_FLOW = ['ordered', 'collected', 'received', 'processing', 'result_ready', 'delivered'];
const SAMPLE_STYLES: Record<string, string> = {
  ordered: 'bg-gray-100 text-gray-600', collected: 'bg-sky-100 text-sky-800', received: 'bg-sky-100 text-sky-800',
  processing: 'bg-amber-100 text-amber-800', result_ready: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-emerald-100 text-emerald-800', rejected: 'bg-crimson-100 text-crimson-800'
};

function SampleCard({ sample, onChanged }: { sample: any; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const idx = SAMPLE_FLOW.indexOf(sample.status);
  const next = sample.status !== 'rejected' && idx < SAMPLE_FLOW.length - 1 ? SAMPLE_FLOW[idx + 1] : null;

  async function advance() {
    setBusy(true);
    try { await api.put(`/api/lab/samples/${sample.id}`, { status: next }); onChanged(); }
    finally { setBusy(false); }
  }
  async function reject() {
    if (!reason.trim()) return;
    setBusy(true);
    try { await api.put(`/api/lab/samples/${sample.id}`, { status: 'rejected', rejection_reason: reason }); setRejecting(false); setReason(''); onChanged(); }
    finally { setBusy(false); }
  }
  async function recollect() {
    setBusy(true);
    try { await api.post(`/api/lab/samples/${sample.id}/recollect`); onChanged(); }
    finally { setBusy(false); }
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono-num font-semibold text-navy-900 text-sm">{sample.sample_id}</p>
          <p className="text-xs text-gray-400 capitalize">{sample.sample_type}</p>
        </div>
        <span className={`kmc-badge ${SAMPLE_STYLES[sample.status] || ''}`}>{sample.status.replace('_', ' ')}</span>
      </div>
      <img src={`/api/lab/samples/${sample.id}/barcode`} alt="" className="h-10" onError={e => (e.currentTarget.style.display = 'none')} />
      {sample.status === 'rejected' && sample.rejection_reason && (
        <p className="text-xs text-crimson-600">Rejected: {sample.rejection_reason}</p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {next && <button disabled={busy} onClick={advance} className="kmc-btn-ghost text-xs px-3 py-1.5">Mark {next.replace('_', ' ')}</button>}
        {sample.status !== 'rejected' && sample.status !== 'delivered' && (
          <button disabled={busy} onClick={() => setRejecting(!rejecting)} className="text-xs text-crimson-600 hover:underline px-1">Reject</button>
        )}
        {sample.status === 'rejected' && sample.recollect_required === 1 && (
          <button disabled={busy} onClick={recollect} className="kmc-btn-ghost text-xs px-3 py-1.5">Recollect</button>
        )}
      </div>
      {rejecting && (
        <div className="flex gap-2 pt-1">
          <input className="kmc-input text-xs py-1.5" placeholder="Rejection reason..." value={reason} onChange={e => setReason(e.target.value)} />
          <button disabled={busy} onClick={reject} className="kmc-btn-primary text-xs px-3">Confirm</button>
        </div>
      )}
    </div>
  );
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'same-origin' });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

const PAY_LABELS: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };
const PAY_METHODS = ['cash','jazzcash','easypaisa','bank_transfer','card'];
const STATUSES = [
  { value: 'pending',    label: 'Pending',    color: 'bg-amber-100 text-amber-800' },
  { value: 'processing', label: 'Processing', color: 'bg-sky-100 text-sky-800' },
  { value: 'completed',  label: 'Completed',  color: 'bg-emerald-100 text-emerald-800' },
  { value: 'cancelled',  label: 'Cancelled',  color: 'bg-gray-200 text-gray-600' },
];

export default function LabOrderDetailPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-16">Loading...</div>}>
      <LabOrderDetailInner />
    </Suspense>
  );
}

function LabOrderDetailInner() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const id = params.id as string;
  const isNew = search.get('new') === '1';
  const isSuperAdmin = session?.role === 'super_admin';
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    if (!order) return;
    setPrinting(true);
    try {
      const [clinic, barcodeUrl] = await Promise.all([
        api.get('/api/clinic'),
        fetchAsDataUrl(`/api/lab/orders/${id}/barcode`)
      ]);
      printThermal(labReceiptHtml(order, clinic, barcodeUrl));
    } catch {
      const clinic = await api.get('/api/clinic').catch(() => ({ name: 'Lab', address: '', phone: '' }));
      printThermal(labReceiptHtml(order, clinic));
    } finally { setPrinting(false); }
  }

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPay, setEditingPay] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/api/lab/orders/${id}`);
      setOrder(data.order);
      setPaidAmount(data.order.paid_amount);
      setPayMethod(data.order.payment_method);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true);
    try { const d = await api.put(`/api/lab/orders/${id}`, { status: newStatus }); setOrder(d.order); }
    catch (e: any) { setError(e.message); }
    finally { setUpdatingStatus(false); }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try { const d = await api.put(`/api/lab/orders/${id}`, { paid_amount: paidAmount, payment_method: payMethod }); setOrder(d.order); setEditingPay(false); }
    catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleWhatsApp() {
    try {
      const res = await api.post(`/api/lab/orders/${id}/whatsapp`);
      if (res.shareLink) window.open(res.shareLink, '_blank');
    } catch (e: any) { setError(e.message); }
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this lab order? This cannot be undone.')) return;
    setDeleting(true);
    try { await api.delete(`/api/lab/orders/${id}`); router.push('/dashboard/lab/orders'); }
    catch (e: any) { setError(e.message); setDeleting(false); }
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>;
  if (!order && error) return <div className="kmc-card p-5 border-crimson-200 bg-crimson-50 text-crimson-700">{error}</div>;
  if (!order) return null;

  const currentStatus = STATUSES.find(s => s.value === order.status);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/dashboard/lab/orders')} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5">
          <ArrowLeft size={15}/> Back to orders
        </button>
        {isSuperAdmin && (
          <button onClick={handleDelete} disabled={deleting} className="text-sm text-gray-400 hover:text-crimson-600 flex items-center gap-1.5">
            <Trash2 size={14}/> {deleting ? 'Deleting...' : 'Delete Order'}
          </button>
        )}
      </div>

      {isNew && (
        <div className="kmc-card p-4 bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 size={18}/> Lab order booked successfully.
        </div>
      )}
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {/* Order header card */}
      <div className="kmc-card overflow-hidden">
        <div className="bg-navy-900 text-white px-6 py-5 flex items-start justify-between">
          <div>
            <p className="font-display font-bold text-lg tracking-wide">{order.order_no}</p>
            <p className="text-navy-200 text-xs mt-0.5">{new Date(order.created_at).toLocaleString('en-PK')}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`kmc-badge font-bold px-3 py-1.5 ${currentStatus?.color || ''}`}>
              {currentStatus?.label}
            </span>
            {order.priority && order.priority !== 'routine' && (
              <span className={`kmc-badge px-2.5 py-1 ${order.priority === 'stat' ? 'bg-crimson-100 text-crimson-800' : 'bg-amber-100 text-amber-800'}`}>
                {order.priority.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <p className="kmc-label">Patient</p>
            <p className="font-semibold text-navy-900 text-base">{order.patient_name}</p>
            {order.patient_phone && <p className="text-gray-500 font-mono-num text-xs mt-0.5">{order.patient_phone}</p>}
            {(order.patient_age || order.patient_gender) && (
              <p className="text-gray-400 text-xs mt-0.5">{order.patient_gender}{order.patient_age ? ` · ${order.patient_age} yrs` : ''}</p>
            )}
          </div>
          {(order.linked_appointment_no || order.linked_admission_no) && (
            <div>
              <p className="kmc-label">Linked Visit</p>
              <p className="text-gray-700">{order.linked_appointment_no ? `Appointment #${order.linked_appointment_no}` : `Admission #${order.linked_admission_no}`}</p>
            </div>
          )}
          {(order.insurance_provider || order.tpa_reference) && (
            <div>
              <p className="kmc-label">Insurance / TPA</p>
              <p className="text-gray-700">{order.insurance_provider || '—'}{order.tpa_reference ? ` · ${order.tpa_reference}` : ''}</p>
              <span className={`kmc-badge mt-1 ${order.claim_status === 'approved' ? 'bg-emerald-100 text-emerald-800' : order.claim_status === 'rejected' ? 'bg-crimson-100 text-crimson-800' : 'bg-amber-100 text-amber-800'}`}>{order.claim_status}</span>
            </div>
          )}
          <div>
            <p className="kmc-label">Payment</p>
            <p className="font-semibold text-navy-900">{PAY_LABELS[order.payment_method]}</p>
            <span className={`kmc-badge mt-1 ${order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : order.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'}`}>
              {order.payment_status}
            </span>
          </div>
          {order.referring_doctor && (
            <div>
              <p className="kmc-label">Referred by</p>
              <p className="text-gray-700">Dr. {order.referring_doctor}</p>
            </div>
          )}
          <div>
            <p className="kmc-label">Booked by</p>
            <p className="text-gray-700">{order.booked_by_name}</p>
          </div>
        </div>

        {/* Tests table (panels grouped) */}
        <div className="border-t border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Test</th>
                <th className="px-5 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {(order.panels || []).map((panel: any) => (
                <React.Fragment key={`panel-${panel.id}`}>
                  <tr className="bg-mist/60 border-b border-gray-50">
                    <td className="px-5 py-2.5 font-semibold text-crimson-700 text-xs uppercase tracking-wide">{panel.panel_name} (panel)</td>
                    <td className="px-5 py-2.5 font-mono-num font-semibold text-navy-900 text-right">Rs. {panel.price}</td>
                  </tr>
                  {(order.items || []).filter((i: any) => i.order_panel_id === panel.id).map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-2 pl-8 text-gray-600">{item.test_name}</td>
                      <td className="px-5 py-2 text-right text-gray-400">included</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {(order.items || []).filter((i: any) => !i.order_panel_id).map((item: any) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-navy-900">{item.test_name}</td>
                  <td className="px-5 py-3 font-mono-num font-semibold text-navy-900 text-right">Rs. {item.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-4 space-y-1.5 border-t border-gray-100 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span className="font-mono-num">Rs. {order.subtotal}</span></div>
          {order.discount > 0 && <div className="flex justify-between text-gray-500"><span>Discount</span><span className="font-mono-num">Rs. {order.discount}</span></div>}
          <div className="flex justify-between font-bold text-navy-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span className="font-mono-num">Rs. {order.total}</span></div>
          <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="font-mono-num font-semibold">Rs. {order.paid_amount}</span></div>
          {order.total - order.paid_amount > 0 && (
            <div className="flex justify-between text-crimson-600"><span>Balance Due</span><span className="font-mono-num font-semibold">Rs. {order.total - order.paid_amount}</span></div>
          )}
        </div>

        {/* Barcode */}
        <div className="px-6 pb-5 flex flex-col items-center gap-2">
          <img src={`/api/appointments/lookup?code=${order.order_no}`} alt="" className="hidden"/>
          <img
            src={`/api/lab/orders/${id}/barcode`}
            alt={`Barcode for ${order.order_no}`}
            className="h-14"
            onError={e => (e.currentTarget.style.display = 'none')}
          />
          <p className="font-mono-num text-xs text-gray-400">{order.order_no}</p>
        </div>
      </div>

      {/* Samples */}
      {(order.samples || []).length > 0 && (
        <div className="kmc-card p-5 space-y-3">
          <h3 className="font-display font-semibold text-navy-900 flex items-center gap-2"><FlaskConical size={17}/> Samples</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {order.samples.map((s: any) => <SampleCard key={s.id} sample={s} onChanged={load} />)}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="kmc-card p-5 space-y-4">
        <h3 className="font-display font-semibold text-navy-900">Actions</h3>

        <div className="flex flex-wrap gap-3">
          <button onClick={handlePrint} disabled={printing} className="kmc-btn-ghost flex items-center gap-2">
            <Printer size={16}/> {printing ? 'Preparing...' : 'Print Receipt'}
          </button>
          <a href={`/api/lab/orders/${id}/pdf`} target="_blank" rel="noreferrer" className="kmc-btn-primary flex items-center gap-2">
            <Download size={16}/> Download PDF
          </a>
          {order.patient_phone && (
            <button onClick={handleWhatsApp} className="kmc-btn-accent flex items-center gap-2">
              <MessageCircle size={16}/> Send via WhatsApp
            </button>
          )}
          <button onClick={() => setEditingPay(!editingPay)} className="kmc-btn-ghost flex items-center gap-2">
            <Pencil size={15}/> Update Payment
          </button>
          <Link href={`/dashboard/lab/orders/${id}/results`} className="kmc-btn-ghost flex items-center gap-2">
            <FlaskConical size={16}/> Enter Results
          </Link>
          {order.report_status !== 'pending' && (
            <Link href={`/print/lab/reports/${id}`} target="_blank" className="kmc-btn-accent flex items-center gap-2">
              <FileText size={16}/> View / Print Report
            </Link>
          )}
        </div>

        {editingPay && (
          <form onSubmit={handleSavePayment} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
            <div>
              <label className="kmc-label">Payment Method</label>
              <select className="kmc-input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                {PAY_METHODS.map(m => <option key={m} value={m}>{PAY_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="kmc-label">Paid Amount (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))}/>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={saving} className="kmc-btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => setEditingPay(false)} className="kmc-btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        <div className="pt-2 border-t border-gray-100">
          <p className="kmc-label mb-2">Update Order Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map(s => (
              <button key={s.value} disabled={updatingStatus} onClick={() => handleStatusChange(s.value)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  order.status === s.value
                    ? `${s.color} border-transparent shadow-sm scale-105`
                    : 'border-gray-200 text-gray-600 hover:bg-mist'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {order.notes && (
          <div className="pt-2 border-t border-gray-100">
            <p className="kmc-label">Notes</p>
            <p className="text-sm text-gray-600">{order.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
