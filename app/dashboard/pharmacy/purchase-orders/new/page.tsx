'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Trash2, Search } from 'lucide-react';
import { api } from '@/lib/api-client';

type Medicine = { id: number; name: string; unit: string; purchase_price: number; };
type Supplier = { id: number; name: string; };
type Line = { medicine: Medicine; ordered_qty: number; unit_price: number; };

export default function NewPurchaseOrderPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-16">Loading...</div>}>
      <NewPurchaseOrderInner/>
    </Suspense>
  );
}

function NewPurchaseOrderInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState(search.get('supplier_id') || '');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [filtered, setFiltered] = useState<Medicine[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/pharmacy/suppliers').then(d => setSuppliers(d.suppliers || [])).catch(() => {});
    api.get('/api/pharmacy/medicines?all=1').then(d => setMedicines(d.medicines || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!medSearch.trim()) { setFiltered([]); return; }
    const q = medSearch.toLowerCase();
    setFiltered(medicines.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8));
  }, [medSearch, medicines]);

  function addLine(med: Medicine) {
    setLines(prev => {
      const existing = prev.find(l => l.medicine.id === med.id);
      if (existing) return prev.map(l => l.medicine.id === med.id ? {...l, ordered_qty: l.ordered_qty + 1} : l);
      return [...prev, { medicine: med, ordered_qty: 1, unit_price: med.purchase_price }];
    });
    setMedSearch(''); setShowDrop(false);
  }

  function updateLine(idx: number, field: 'ordered_qty'|'unit_price', val: number) {
    setLines(prev => prev.map((l, n) => n === idx ? {...l, [field]: val} : l));
  }

  function removeLine(idx: number) { setLines(prev => prev.filter((_, n) => n !== idx)); }

  const subtotal = lines.reduce((s, l) => s + l.ordered_qty * l.unit_price, 0);
  const total = Math.max(subtotal - discount, 0);

  async function handleSubmit(e: React.FormEvent, status: 'draft' | 'ordered') {
    e.preventDefault();
    if (!supplierId) { setError('Select a supplier.'); return; }
    if (lines.length === 0) { setError('Add at least one medicine.'); return; }
    setSubmitting(true); setError('');
    try {
      const payload = {
        supplier_id: Number(supplierId), status,
        items: lines.map(l => ({ medicine_id: l.medicine.id, ordered_qty: l.ordered_qty, unit_price: l.unit_price })),
        discount, expected_date: expectedDate || null, notes,
      };
      const data = await api.post('/api/pharmacy/purchase-orders', payload);
      router.push(`/dashboard/pharmacy/purchase-orders/${data.id}`);
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">New Purchase Order</h1>
        <p className="text-sm text-gray-500 mt-1">Order medicines from a supplier.</p>
      </div>
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <form className="space-y-5">
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">Supplier</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="kmc-label">Supplier *</label>
              <select className="kmc-input" value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="kmc-label">Expected Delivery Date</label>
              <input type="date" className="kmc-input" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}/>
            </div>
          </div>
        </section>

        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">Medicines</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input className="kmc-input pl-9" placeholder="Search medicine by name..." value={medSearch}
              onChange={e => { setMedSearch(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)} onBlur={() => setTimeout(() => setShowDrop(false), 150)}/>
            {showDrop && filtered.length > 0 && (
              <div className="absolute z-30 mt-1 w-full kmc-card shadow-pop max-h-56 overflow-y-auto">
                {filtered.map(m => (
                  <button key={m.id} type="button" onMouseDown={() => addLine(m)}
                    className="w-full text-left px-4 py-2.5 hover:bg-mist border-b border-gray-50 last:border-0 flex justify-between">
                    <span className="font-medium text-navy-900 text-sm">{m.name} <span className="text-gray-400 text-xs">({m.unit})</span></span>
                    <span className="text-xs text-gray-500">Last purchase: Rs. {m.purchase_price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                    <th className="pb-2">Medicine</th><th className="pb-2">Ordered Qty</th><th className="pb-2">Unit Price</th><th className="pb-2 text-right">Total</th><th/>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-navy-900">{l.medicine.name}</p>
                        <p className="text-xs text-gray-400">{l.medicine.unit}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <input type="number" min="1" className="kmc-input w-24 font-mono-num text-sm"
                          value={l.ordered_qty} onChange={e => updateLine(idx, 'ordered_qty', Number(e.target.value))}/>
                      </td>
                      <td className="py-2.5 pr-3">
                        <input type="number" min="0" className="kmc-input w-28 font-mono-num text-sm"
                          value={l.unit_price} onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))}/>
                      </td>
                      <td className="py-2.5 font-mono-num font-semibold text-navy-900 text-right pr-3">
                        Rs. {(l.ordered_qty * l.unit_price).toFixed(0)}
                      </td>
                      <td className="py-2.5">
                        <button type="button" onClick={() => removeLine(idx)} className="text-gray-300 hover:text-crimson-600"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lines.length === 0 && (
            <div className="mt-4 text-center text-gray-400 text-sm py-6 border-2 border-dashed border-gray-100 rounded-xl">
              Search and add medicines above
            </div>
          )}
        </section>

        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Totals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="kmc-label">Subtotal</label>
              <input readOnly className="kmc-input font-mono-num bg-mist" value={`Rs. ${subtotal.toFixed(0)}`}/>
            </div>
            <div>
              <label className="kmc-label">Discount (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={discount} onChange={e => setDiscount(Number(e.target.value))}/>
            </div>
            <div>
              <label className="kmc-label">Total</label>
              <input readOnly className="kmc-input font-mono-num bg-mist font-bold" value={`Rs. ${total.toFixed(0)}`}/>
            </div>
          </div>
          <div className="mt-3">
            <label className="kmc-label">Notes</label>
            <input className="kmc-input" placeholder="Optional remarks..." value={notes} onChange={e => setNotes(e.target.value)}/>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button type="button" disabled={submitting} onClick={(e) => handleSubmit(e, 'draft')} className="kmc-btn-ghost">
            {submitting ? 'Saving...' : 'Save as Draft'}
          </button>
          <button type="button" disabled={submitting} onClick={(e) => handleSubmit(e, 'ordered')} className="kmc-btn-accent">
            {submitting ? 'Saving...' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
