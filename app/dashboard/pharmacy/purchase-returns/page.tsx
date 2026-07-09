'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, X, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';

type Supplier = { id: number; name: string; };
type Batch = { id: number; medicine_id: number; medicine_name: string; unit: string; batch_no: string; expiry_date: string; qty: number; purchase_price: number; supplier_id: number | null; };
type Line = { batch: Batch; qty: number; unit_price: number; };

export default function PurchaseReturnsPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-16">Loading...</div>}>
      <PurchaseReturnsInner/>
    </Suspense>
  );
}

function PurchaseReturnsInner() {
  const search = useSearchParams();
  const [returns, setReturns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api.get('/api/pharmacy/purchase-returns'),
        api.get('/api/pharmacy/suppliers'),
      ]);
      setReturns(r.purchaseReturns || []);
      setSuppliers(s.suppliers || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const batchId = search.get('batch_id');
    if (!batchId) return;
    api.get(`/api/pharmacy/batches?id=${batchId}`).then(d => {
      const batch: Batch | undefined = (d.batches || [])[0];
      if (batch && batch.supplier_id) {
        setShowForm(true);
        setSupplierId(String(batch.supplier_id));
        setLines([{ batch, qty: 1, unit_price: batch.purchase_price }]);
      }
    }).catch(() => {});
  }, [search]);

  useEffect(() => {
    if (!supplierId) { setBatches([]); return; }
    api.get(`/api/pharmacy/batches?supplier_id=${supplierId}&min_qty=0.01`).then(d => setBatches(d.batches || [])).catch(() => {});
  }, [supplierId]);

  function addLine(batch: Batch) {
    setLines(prev => prev.find(l => l.batch.id === batch.id) ? prev : [...prev, { batch, qty: 1, unit_price: batch.purchase_price }]);
  }
  function updateLine(idx: number, field: 'qty'|'unit_price', val: number) {
    setLines(prev => prev.map((l, n) => n === idx ? {...l, [field]: val} : l));
  }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, n) => n !== idx)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (!supplierId) throw new Error('Select a supplier.');
      if (lines.length === 0) throw new Error('Add at least one batch to return.');
      await api.post('/api/pharmacy/purchase-returns', {
        supplier_id: Number(supplierId), reason,
        items: lines.map(l => ({ batch_id: l.batch.id, qty: l.qty, unit_price: l.unit_price })),
      });
      setShowForm(false); setSupplierId(''); setLines([]); setReason(''); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Purchase Returns</h1>
          <p className="text-sm text-gray-500 mt-1">Return batch stock back to a supplier.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>New Return</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">New Purchase Return</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="kmc-label">Supplier *</label>
                <select className="kmc-input" value={supplierId} onChange={e => { setSupplierId(e.target.value); setLines([]); }} required>
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="kmc-label">Reason</label>
                <input className="kmc-input" placeholder="e.g. damaged, wrong item, near expiry" value={reason} onChange={e => setReason(e.target.value)}/>
              </div>
            </div>

            {supplierId && (
              <div>
                <label className="kmc-label">Available Batches</label>
                {batches.length === 0 && <p className="text-sm text-gray-400 py-2">No batches on hand from this supplier.</p>}
                <div className="flex flex-wrap gap-2">
                  {batches.map(b => (
                    <button type="button" key={b.id} onClick={() => addLine(b)}
                      className="text-xs font-semibold border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-mist">
                      {b.medicine_name} — {b.batch_no} ({b.qty} {b.unit})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {lines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                      <th className="pb-2">Medicine / Batch</th><th className="pb-2">Qty</th><th className="pb-2">Unit Price</th><th className="pb-2 text-right">Total</th><th/>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr key={idx} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-navy-900">{l.batch.medicine_name}</p>
                          <p className="text-xs text-gray-400">Batch {l.batch.batch_no} — available {l.batch.qty}</p>
                        </td>
                        <td className="py-2.5 pr-3">
                          <input type="number" min="0.5" step="0.5" max={l.batch.qty} className="kmc-input w-20 font-mono-num text-sm"
                            value={l.qty} onChange={e => updateLine(idx, 'qty', Number(e.target.value))}/>
                        </td>
                        <td className="py-2.5 pr-3">
                          <input type="number" min="0" className="kmc-input w-28 font-mono-num text-sm"
                            value={l.unit_price} onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))}/>
                        </td>
                        <td className="py-2.5 font-mono-num font-semibold text-navy-900 text-right pr-3">Rs. {(l.qty * l.unit_price).toFixed(0)}</td>
                        <td className="py-2.5"><button type="button" onClick={() => removeLine(idx)} className="text-gray-300 hover:text-crimson-600"><Trash2 size={14}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-right font-mono-num font-bold text-navy-900 mt-2">Total: Rs. {total.toFixed(0)}</div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : 'Submit Return'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Return No.','Date','Supplier','Reason','Total','By'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && returns.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No purchase returns yet.</td></tr>}
            {returns.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-mono-num text-navy-800">{r.return_no}</td>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-3 font-medium text-navy-900">{r.supplier_name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.reason || '—'}</td>
                <td className="px-4 py-3 font-mono-num font-semibold">Rs. {r.total}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.created_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
