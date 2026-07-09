'use client';
import { useEffect, useState } from 'react';
import { Plus, X, FlaskConical, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api-client';

const empty = { name: '', unit: 'ml', stock_qty: '0', low_stock_at: '10' };
const batchEmpty = { batch_no: '', expiry_date: '', qty: '' };

export default function LabReagentsPage() {
  const [reagents, setReagents] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [batchFor, setBatchFor] = useState<number | null>(null);
  const [batchForm, setBatchForm] = useState(batchEmpty);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get('/api/lab/reagents');
      setReagents(d.reagents || []); setLowStock(d.lowStock || []); setExpiringSoon(d.expiringSoon || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.post('/api/lab/reagents', { ...form, stock_qty: Number(form.stock_qty), low_stock_at: Number(form.low_stock_at) });
      setShowForm(false); setForm(empty); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!batchFor) return;
    try {
      await api.post('/api/lab/reagent-batches', { reagent_id: batchFor, ...batchForm, qty: Number(batchForm.qty) });
      setBatchFor(null); setBatchForm(batchEmpty); load();
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2"><FlaskConical size={22} className="text-sky-600"/> Reagents &amp; Consumables</h1>
          <p className="text-sm text-gray-500 mt-1">Stock levels, batches and expiry tracking.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/> Add Reagent</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {lowStock.length > 0 && (
        <div className="kmc-card p-4 border-amber-200 bg-amber-50 text-amber-800 flex items-start gap-2 text-sm">
          <AlertTriangle size={16} className="mt-0.5"/>
          <div><p className="font-semibold">Low Stock</p><p>{lowStock.map((r: any) => `${r.name} (${r.stock_qty} ${r.unit})`).join(', ')}</p></div>
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 flex items-start gap-2 text-sm">
          <AlertTriangle size={16} className="mt-0.5"/>
          <div><p className="font-semibold">Expiring Within 30 Days</p><p>{expiringSoon.map((b: any) => `${b.reagent_name} (${b.batch_no}, exp ${b.expiry_date})`).join(', ')}</p></div>
        </div>
      )}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Add Reagent</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div><label className="kmc-label">Name *</label><input className="kmc-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required/></div>
            <div><label className="kmc-label">Unit</label><input className="kmc-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}/></div>
            <div><label className="kmc-label">Opening Stock</label><input type="number" className="kmc-input font-mono-num" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })}/></div>
            <div><label className="kmc-label">Low Stock At</label><input type="number" className="kmc-input font-mono-num" value={form.low_stock_at} onChange={e => setForm({ ...form, low_stock_at: e.target.value })}/></div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : 'Add Reagent'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="kmc-card p-8 text-center text-gray-400">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reagents.map((r: any) => (
            <div key={r.id} className="kmc-card p-5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-navy-900">{r.name}</p>
                <span className={`kmc-badge ${r.stock_qty <= r.low_stock_at ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{r.stock_qty} {r.unit}</span>
              </div>
              <div className="mt-2 space-y-1">
                {(r.batches || []).map((b: any) => (
                  <p key={b.id} className="text-xs text-gray-500">Batch {b.batch_no} — {b.qty} {r.unit}, exp {b.expiry_date}</p>
                ))}
                {(r.batches || []).length === 0 && <p className="text-xs text-gray-400">No batches recorded.</p>}
              </div>
              <button onClick={() => setBatchFor(batchFor === r.id ? null : r.id)} className="kmc-btn-ghost text-xs px-3 py-1.5 mt-3">Add Batch / Stock In</button>
              {batchFor === r.id && (
                <form onSubmit={handleBatchSubmit} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <input className="kmc-input text-xs" placeholder="Batch no." value={batchForm.batch_no} onChange={ev => setBatchForm({ ...batchForm, batch_no: ev.target.value })} required/>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" className="kmc-input text-xs" value={batchForm.expiry_date} onChange={ev => setBatchForm({ ...batchForm, expiry_date: ev.target.value })} required/>
                    <input type="number" className="kmc-input text-xs font-mono-num" placeholder="Qty" value={batchForm.qty} onChange={ev => setBatchForm({ ...batchForm, qty: ev.target.value })} required/>
                  </div>
                  <button type="submit" className="kmc-btn-primary text-xs px-3 py-1.5">Save</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
