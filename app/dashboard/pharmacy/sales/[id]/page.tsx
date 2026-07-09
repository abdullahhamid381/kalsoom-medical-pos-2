'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, MessageCircle, CheckCircle2, Trash2, Pencil, RotateCcw, FileUp } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { printThermal, pharmacyReceiptHtml } from '@/lib/thermal-print';

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

export default function SaleDetailPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-16">Loading...</div>}>
      <SaleDetailInner/>
    </Suspense>
  );
}

function SaleDetailInner() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const id = params.id as string;
  const isNew = search.get('new') === '1';

  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  const [returns, setReturns] = useState<any[]>([]);
  const [showReturn, setShowReturn] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<number, string>>({});
  const [returnOutcome, setReturnOutcome] = useState<'refund'|'store_credit'|'exchange'>('refund');
  const [returnReason, setReturnReason] = useState('');
  const [returningNow, setReturningNow] = useState(false);

  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const isSuperAdmin = session?.role === 'super_admin';
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    if (!sale) return;
    setPrinting(true);
    try {
      const clinic = await api.get('/api/clinic');
      printThermal(pharmacyReceiptHtml(sale, clinic));
    } catch { /* silent */ } finally { setPrinting(false); }
  }

  async function load() {
    try {
      const data = await api.get(`/api/pharmacy/sales/${id}`);
      setSale(data.sale);
      setPaidAmount(data.sale.paid_amount);
      setPayMethod(data.sale.payment_method);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadReturns() {
    try { const d = await api.get(`/api/pharmacy/sales/${id}/returns`); setReturns(d.returns || []); } catch { /* silent */ }
  }

  async function loadPrescriptions() {
    try { const d = await api.get(`/api/pharmacy/prescriptions?sale_id=${id}`); setPrescriptions(d.prescriptions || []); } catch { /* silent */ }
  }

  useEffect(() => { load(); loadReturns(); loadPrescriptions(); }, [id]);

  function openReturn() {
    const qtys: Record<number, string> = {};
    for (const item of sale.items || []) {
      const returnable = item.qty - (item.returned_qty || 0);
      if (returnable > 0) qtys[item.id] = '0';
    }
    setReturnQtys(qtys);
    setShowReturn(true);
  }

  async function handleReturnSubmit(e: React.FormEvent) {
    e.preventDefault(); setReturningNow(true); setError('');
    try {
      const items = Object.entries(returnQtys)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([sale_item_id, qty]) => ({ sale_item_id: Number(sale_item_id), qty: Number(qty) }));
      if (items.length === 0) { setError('Enter a quantity to return for at least one item.'); setReturningNow(false); return; }
      await api.post(`/api/pharmacy/sales/${id}/returns`, { items, outcome: returnOutcome, reason: returnReason });
      setShowReturn(false); setReturnReason(''); load(); loadReturns();
    } catch (e: any) { setError(e.message); }
    finally { setReturningNow(false); }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) { setError('Choose a file first.'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('sale_id', id);
      if (sale.patient_id) fd.append('patient_id', String(sale.patient_id));
      fd.append('patient_name', sale.patient_name || '');
      fd.append('patient_phone', sale.patient_phone || '');
      const res = await fetch('/api/pharmacy/prescriptions', { method: 'POST', body: fd, credentials: 'same-origin' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Upload failed.');
      setShowUpload(false); setUploadFile(null); loadPrescriptions();
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/api/pharmacy/sales/${id}`, { paid_amount: paidAmount, payment_method: payMethod });
      setEditing(false); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm('Delete this sale? Stock will be restored.')) return;
    try { await api.delete(`/api/pharmacy/sales/${id}`); router.push('/dashboard/pharmacy/sales'); }
    catch (e: any) { setError(e.message); }
  }

  async function handleWhatsApp() {
    try {
      const res = await api.post(`/api/pharmacy/sales/${id}/whatsapp`);
      if (res.shareLink) window.open(res.shareLink, '_blank');
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>;
  if (!sale && error) return <div className="kmc-card p-5 border-crimson-200 bg-crimson-50 text-crimson-700">{error}</div>;
  if (!sale) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/dashboard/pharmacy/sales')} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5">
          <ArrowLeft size={15}/> Back to sales
        </button>
        {isSuperAdmin && (
          <button onClick={handleDelete} className="text-sm text-gray-400 hover:text-crimson-600 flex items-center gap-1.5 font-medium">
            <Trash2 size={14}/> Delete & Restore Stock
          </button>
        )}
      </div>

      {isNew && (
        <div className="kmc-card p-4 bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 size={18}/> Sale completed successfully.
        </div>
      )}
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {/* Sale header */}
      <div className="kmc-card overflow-hidden">
        <div className="bg-navy-900 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-lg">{sale.sale_no}</p>
            <p className="text-navy-200 text-xs mt-0.5">{new Date(sale.created_at).toLocaleString('en-PK')}</p>
          </div>
          <span className={`kmc-badge text-sm font-bold px-3 py-1.5 ${sale.payment_status==='paid' ? 'bg-emerald-100 text-emerald-800' : sale.payment_status==='partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'}`}>
            {sale.payment_status.toUpperCase()}
          </span>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="kmc-label">Patient</p>
            <p className="font-semibold text-navy-900">{sale.patient_name}</p>
            {sale.patient_phone && <p className="text-gray-500 font-mono-num text-xs">{sale.patient_phone}</p>}
          </div>
          <div>
            <p className="kmc-label">Payment</p>
            <p className="font-semibold text-navy-900">{PAY_LABELS[sale.payment_method]}</p>
            <p className="text-xs text-gray-400">Sold by {sale.sold_by_name}</p>
          </div>
        </div>

        {/* Items table */}
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Medicine</th><th className="px-5 py-3">Qty</th><th className="px-5 py-3">Unit Price</th><th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items || []).map((item: any) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-navy-900">
                    {item.medicine_name}
                    {item.returned_qty > 0 && <span className="kmc-badge bg-gray-200 text-gray-700 ml-1.5 align-middle">{item.returned_qty} returned</span>}
                  </td>
                  <td className="px-5 py-3 font-mono-num text-gray-700">{item.qty} {item.unit}</td>
                  <td className="px-5 py-3 font-mono-num text-gray-600">Rs. {item.unit_price}</td>
                  <td className="px-5 py-3 font-mono-num font-semibold text-navy-900 text-right">Rs. {item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-4 space-y-1 border-t border-gray-100 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span className="font-mono-num">Rs. {sale.subtotal}</span></div>
          {sale.discount > 0 && <div className="flex justify-between text-gray-500"><span>Discount</span><span className="font-mono-num">Rs. {sale.discount}</span></div>}
          <div className="flex justify-between font-bold text-navy-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span className="font-mono-num">Rs. {sale.total}</span></div>
          <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="font-mono-num font-semibold">Rs. {sale.paid_amount}</span></div>
          {sale.total - sale.paid_amount > 0 && (
            <div className="flex justify-between text-crimson-600"><span>Balance Due</span><span className="font-mono-num font-semibold">Rs. {sale.total - sale.paid_amount}</span></div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="kmc-card p-5 space-y-4">
        <h3 className="font-display font-semibold text-navy-900">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={handlePrint} disabled={printing} className="kmc-btn-ghost flex items-center gap-2">
            <Printer size={16}/> {printing ? 'Preparing...' : 'Print Receipt'}
          </button>
          {(sale.patient_phone) && (
            <button onClick={handleWhatsApp} className="kmc-btn-accent flex items-center gap-2">
              <MessageCircle size={16}/> 'Send via WhatsApp'
            </button>
          )}
          <button onClick={() => setEditing(!editing)} className="kmc-btn-primary flex items-center gap-2">
            <Pencil size={15}/> Update Payment
          </button>
          {(sale.items || []).some((i: any) => i.qty - (i.returned_qty || 0) > 0) && (
            <button onClick={openReturn} className="kmc-btn-ghost flex items-center gap-2">
              <RotateCcw size={15}/> Return Items
            </button>
          )}
          <button onClick={() => setShowUpload(!showUpload)} className="kmc-btn-ghost flex items-center gap-2">
            <FileUp size={15}/> Attach Prescription
          </button>
        </div>

        {editing && (
          <form onSubmit={handleSavePayment} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
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
              <button type="button" onClick={() => setEditing(false)} className="kmc-btn-ghost">Cancel</button>
            </div>
          </form>
        )}

        {showReturn && (
          <form onSubmit={handleReturnSubmit} className="space-y-3 pt-2 border-t border-gray-100">
            {(sale.items || []).filter((i: any) => i.qty - (i.returned_qty || 0) > 0).map((item: any) => {
              const returnable = item.qty - (item.returned_qty || 0);
              return (
                <div key={item.id} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-navy-900">{item.medicine_name}</p>
                    <p className="text-xs text-gray-400">Returnable: {returnable} {item.unit}</p>
                  </div>
                  <div>
                    <label className="kmc-label">Qty to Return</label>
                    <input type="number" min="0" max={returnable} className="kmc-input font-mono-num text-sm"
                      value={returnQtys[item.id] ?? '0'} onChange={e => setReturnQtys({ ...returnQtys, [item.id]: e.target.value })}/>
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="kmc-label">Outcome</label>
                <select className="kmc-input" value={returnOutcome} onChange={e => setReturnOutcome(e.target.value as any)}>
                  <option value="refund">Refund</option>
                  <option value="store_credit">Store Credit</option>
                  <option value="exchange">Exchange (issues store credit)</option>
                </select>
              </div>
              <div>
                <label className="kmc-label">Reason</label>
                <input className="kmc-input" value={returnReason} onChange={e => setReturnReason(e.target.value)}/>
              </div>
            </div>
            {(returnOutcome === 'store_credit' || returnOutcome === 'exchange') && !sale.patient_phone && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No phone number on this sale — store credit cannot be tracked for this customer.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowReturn(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={returningNow} className="kmc-btn-primary">{returningNow ? 'Processing...' : 'Submit Return'}</button>
            </div>
          </form>
        )}

        {showUpload && (
          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 pt-2 border-t border-gray-100">
            <div className="flex-1 min-w-[200px]">
              <label className="kmc-label">Prescription File (image or PDF)</label>
              <input type="file" accept="image/*,application/pdf" className="kmc-input" onChange={e => setUploadFile(e.target.files?.[0] || null)}/>
            </div>
            <button type="submit" disabled={uploading} className="kmc-btn-primary">{uploading ? 'Uploading...' : 'Upload'}</button>
            <button type="button" onClick={() => setShowUpload(false)} className="kmc-btn-ghost">Cancel</button>
          </form>
        )}
      </div>

      {returns.length > 0 && (
        <div className="kmc-card overflow-x-auto">
          <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-display font-semibold text-navy-900">Returns</h3></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Return No.</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Outcome</th><th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r: any) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                  onClick={() => window.location.href = `/dashboard/pharmacy/returns/${r.id}`}>
                  <td className="px-5 py-3 font-mono-num text-navy-800">{r.return_no}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{new Date(r.created_at).toLocaleString('en-PK')}</td>
                  <td className="px-5 py-3"><span className="kmc-badge bg-navy-50 text-navy-700 capitalize">{r.outcome.replace('_',' ')}</span></td>
                  <td className="px-5 py-3 font-mono-num font-semibold text-right">Rs. {r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {prescriptions.length > 0 && (
        <div className="kmc-card p-5">
          <h3 className="font-display font-semibold text-navy-900 mb-3">Prescriptions</h3>
          <div className="flex flex-wrap gap-2">
            {prescriptions.map((p: any) => (
              <a key={p.id} href={`/api/pharmacy/prescriptions/${p.id}/file`} target="_blank" rel="noopener noreferrer"
                className="kmc-badge bg-navy-50 text-navy-700 hover:bg-navy-100">
                {p.file_name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
