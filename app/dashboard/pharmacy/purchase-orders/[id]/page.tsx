'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, PackageCheck, Trash2, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api-client';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  ordered: 'bg-sky-100 text-sky-800',
  partially_received: 'bg-amber-100 text-amber-800',
  received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-crimson-100 text-crimson-800',
};

type ReceiveLine = { po_item_id: number; qty: string; batch_no: string; expiry_date: string; mfg_date: string; sale_price: string; location: string; };

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [po, setPo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReceive, setShowReceive] = useState(false);
  const [receiveLines, setReceiveLines] = useState<Record<number, ReceiveLine>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api.get(`/api/pharmacy/purchase-orders/${id}`);
      setPo(data.purchaseOrder);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  function openReceive() {
    if (!po) return;
    const lines: Record<number, ReceiveLine> = {};
    for (const item of po.items) {
      const remaining = item.ordered_qty - item.received_qty;
      if (remaining > 0) {
        lines[item.id] = { po_item_id: item.id, qty: String(remaining), batch_no: '', expiry_date: '', mfg_date: '', sale_price: '', location: 'store' };
      }
    }
    setReceiveLines(lines);
    setShowReceive(true);
  }

  function updateLine(itemId: number, field: keyof ReceiveLine, val: string) {
    setReceiveLines(prev => ({ ...prev, [itemId]: { ...prev[itemId], [field]: val } }));
  }

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const items = Object.values(receiveLines)
        .filter(l => Number(l.qty) > 0)
        .map(l => ({
          po_item_id: l.po_item_id, qty: Number(l.qty), batch_no: l.batch_no, expiry_date: l.expiry_date,
          mfg_date: l.mfg_date || null, sale_price: l.sale_price ? Number(l.sale_price) : undefined, location: l.location,
        }));
      if (items.length === 0) { setError('Enter at least one quantity to receive.'); setSaving(false); return; }
      await api.post(`/api/pharmacy/purchase-orders/${id}/receive`, { items });
      setShowReceive(false); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm('Delete this draft purchase order?')) return;
    try { await api.delete(`/api/pharmacy/purchase-orders/${id}`); router.push('/dashboard/pharmacy/purchase-orders'); }
    catch (e: any) { setError(e.message); }
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>;
  if (!po && error) return <div className="kmc-card p-5 border-crimson-200 bg-crimson-50 text-crimson-700">{error}</div>;
  if (!po) return null;

  const canReceive = po.status !== 'received' && po.status !== 'cancelled' && po.status !== 'draft';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/dashboard/pharmacy/purchase-orders')} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5">
          <ArrowLeft size={15}/> Back to purchase orders
        </button>
        {po.status === 'draft' && (
          <button onClick={handleDelete} className="text-sm text-gray-400 hover:text-crimson-600 flex items-center gap-1.5 font-medium">
            <Trash2 size={14}/> Delete Draft
          </button>
        )}
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <div className="kmc-card overflow-hidden">
        <div className="bg-navy-900 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-lg">{po.po_no}</p>
            <p className="text-navy-200 text-xs mt-0.5">{new Date(po.created_at).toLocaleString('en-PK')}</p>
          </div>
          <span className={`kmc-badge text-sm font-bold px-3 py-1.5 ${STATUS_COLORS[po.status]}`}>{po.status.replace('_',' ').toUpperCase()}</span>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="kmc-label">Supplier</p>
            <a href={`/dashboard/pharmacy/suppliers/${po.supplier_id}`} className="font-semibold text-navy-900 hover:text-crimson-600 flex items-center gap-1">
              {po.supplier_name} <ExternalLink size={12}/>
            </a>
          </div>
          <div>
            <p className="kmc-label">Expected Delivery</p>
            <p className="font-semibold text-navy-900">{po.expected_date || '—'}</p>
            <p className="text-xs text-gray-400">Raised by {po.created_by_name}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Medicine</th><th className="px-5 py-3">Ordered</th><th className="px-5 py-3">Received</th><th className="px-5 py-3">Unit Price</th><th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).map((item: any) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-navy-900">{item.medicine_name}</td>
                  <td className="px-5 py-3 font-mono-num text-gray-700">{item.ordered_qty}</td>
                  <td className={`px-5 py-3 font-mono-num ${item.received_qty >= item.ordered_qty ? 'text-emerald-700 font-semibold' : 'text-amber-700'}`}>{item.received_qty}</td>
                  <td className="px-5 py-3 font-mono-num text-gray-600">Rs. {item.unit_price}</td>
                  <td className="px-5 py-3 font-mono-num font-semibold text-navy-900 text-right">Rs. {item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 space-y-1 border-t border-gray-100 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span className="font-mono-num">Rs. {po.subtotal}</span></div>
          {po.discount > 0 && <div className="flex justify-between text-gray-500"><span>Discount</span><span className="font-mono-num">Rs. {po.discount}</span></div>}
          <div className="flex justify-between font-bold text-navy-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span className="font-mono-num">Rs. {po.total}</span></div>
        </div>
      </div>

      <div className="kmc-card p-5 space-y-4">
        <h3 className="font-display font-semibold text-navy-900">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <a href={`/print/pharmacy/purchase-orders/${id}`} target="_blank" rel="noopener noreferrer" className="kmc-btn-ghost flex items-center gap-2">
            <Printer size={16}/> Print PO
          </a>
          {canReceive && (
            <button onClick={openReceive} className="kmc-btn-accent flex items-center gap-2">
              <PackageCheck size={16}/> Receive Stock
            </button>
          )}
        </div>

        {showReceive && (
          <form onSubmit={handleReceive} className="space-y-4 pt-2 border-t border-gray-100">
            {Object.values(receiveLines).map(line => {
              const item = po.items.find((i: any) => i.id === line.po_item_id);
              const remaining = item.ordered_qty - item.received_qty;
              return (
                <div key={line.po_item_id} className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end border-b border-gray-50 pb-3">
                  <div className="sm:col-span-2">
                    <p className="text-sm font-medium text-navy-900">{item.medicine_name}</p>
                    <p className="text-xs text-gray-400">Remaining: {remaining}</p>
                  </div>
                  <div>
                    <label className="kmc-label">Qty</label>
                    <input type="number" min="0" max={remaining} className="kmc-input font-mono-num text-sm" value={line.qty} onChange={e => updateLine(line.po_item_id, 'qty', e.target.value)}/>
                  </div>
                  <div>
                    <label className="kmc-label">Batch No.</label>
                    <input className="kmc-input text-sm" value={line.batch_no} onChange={e => updateLine(line.po_item_id, 'batch_no', e.target.value)}/>
                  </div>
                  <div>
                    <label className="kmc-label">Expiry Date</label>
                    <input type="date" className="kmc-input text-sm" value={line.expiry_date} onChange={e => updateLine(line.po_item_id, 'expiry_date', e.target.value)}/>
                  </div>
                  <div>
                    <label className="kmc-label">Location</label>
                    <select className="kmc-input text-sm" value={line.location} onChange={e => updateLine(line.po_item_id, 'location', e.target.value)}>
                      <option value="store">Store</option>
                      <option value="pharmacy">Pharmacy Counter</option>
                    </select>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowReceive(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : 'Confirm Receipt'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
