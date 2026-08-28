'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Wallet, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api-client';

const PAY_LABELS: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };
const PAY_METHODS = ['cash','jazzcash','easypaisa','bank_transfer','card'];

export default function SupplierLedgerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPay, setShowPay] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [refNo, setRefNo] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const d = await api.get(`/api/pharmacy/suppliers/${id}/ledger`);
      setData(d);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.post(`/api/pharmacy/suppliers/${id}/payments`, { amount: Number(amount), payment_method: method, reference_no: refNo || null });
      setShowPay(false); setAmount(''); setRefNo(''); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>;
  if (!data && error) return <div className="kmc-card p-5 border-crimson-200 bg-crimson-50 text-crimson-700">{error}</div>;
  if (!data) return null;

  const { supplier, purchaseOrders, payments, purchaseReturns, receivedValue, totalPaid, totalReturned, balance } = data;

  const rows = [
    ...purchaseOrders.map((po: any) => ({ date: po.created_at, label: `PO ${po.po_no}`, type: 'Purchase Order', amount: po.total, kind: 'debit' })),
    ...payments.map((p: any) => ({ date: p.created_at, label: `Payment (${PAY_LABELS[p.payment_method]})${p.reference_no ? ' — ' + p.reference_no : ''}`, type: 'Payment', amount: p.amount, kind: 'credit' })),
    ...purchaseReturns.map((r: any) => ({ date: r.created_at, label: `Return ${r.return_no}`, type: 'Purchase Return', amount: r.total, kind: 'credit' })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button onClick={() => router.push('/dashboard/pharmacy/suppliers')} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5">
        <ArrowLeft size={15}/> Back to suppliers
      </button>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <div className="kmc-card overflow-hidden">
        <div className="bg-navy-900 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-lg">{supplier.name}</p>
            <p className="text-navy-200 text-xs mt-0.5">{supplier.contact_person} {supplier.phone ? `• ${supplier.phone}` : ''}</p>
          </div>
          <span className={`kmc-badge text-sm font-bold px-3 py-1.5 ${balance > 0 ? 'bg-crimson-100 text-crimson-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {balance > 0 ? `Owed: Rs. ${balance.toFixed(0)}` : 'Settled'}
          </span>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div><p className="kmc-label">Received Value</p><p className="font-mono-num font-semibold text-navy-900">Rs. {receivedValue.toFixed(0)}</p></div>
          <div><p className="kmc-label">Paid</p><p className="font-mono-num font-semibold text-emerald-700">Rs. {totalPaid.toFixed(0)}</p></div>
          <div><p className="kmc-label">Returned</p><p className="font-mono-num font-semibold text-gray-600">Rs. {totalReturned.toFixed(0)}</p></div>
        </div>
      </div>

      <div className="kmc-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-navy-900">Actions</h3>
          <div className="flex gap-2">
            <a href={`/dashboard/pharmacy/purchase-orders/new?supplier_id=${id}`} className="kmc-btn-ghost flex items-center gap-2">
              <ShoppingCart size={15}/> New Purchase Order
            </a>
            <button onClick={() => setShowPay(!showPay)} className="kmc-btn-accent flex items-center gap-2">
              <Wallet size={15}/> Record Payment
            </button>
          </div>
        </div>
        {showPay && (
          <form onSubmit={handlePay} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label className="kmc-label">Amount (Rs.) *</label>
              <input type="number" min="1" className="kmc-input font-mono-num" value={amount} onChange={e => setAmount(e.target.value)} required/>
            </div>
            <div>
              <label className="kmc-label">Method</label>
              <select className="kmc-input" value={method} onChange={e => setMethod(e.target.value)}>
                {PAY_METHODS.map(m => <option key={m} value={m}>{PAY_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="kmc-label">Reference No.</label>
              <input className="kmc-input" value={refNo} onChange={e => setRefNo(e.target.value)}/>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={saving} className="kmc-btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => setShowPay(false)} className="kmc-btn-ghost">Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No activity yet.</td></tr>}
            {rows.map((r, idx) => (
              <tr key={idx} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.date).toLocaleDateString('en-PK')}</td>
                <td className="px-4 py-3"><span className="kmc-badge bg-navy-50 text-navy-700">{r.type}</span></td>
                <td className="px-4 py-3 text-gray-700">{r.label}</td>
                <td className={`px-4 py-3 font-mono-num font-semibold text-right ${r.kind === 'debit' ? 'text-crimson-700' : 'text-emerald-700'}`}>
                  {r.kind === 'debit' ? '+' : '-'}Rs. {r.amount.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
