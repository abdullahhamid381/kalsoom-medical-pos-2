'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, Search, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api-client';

type Batch = {
  id: number; medicine_id: number; medicine_name: string; unit: string;
  batch_no: string; expiry_date: string; mfg_date: string | null; qty: number;
  purchase_price: number; sale_price: number; location: string; notes: string | null;
  supplier_id: number | null;
};
type Medicine = { id: number; name: string; unit: string };

const empty = { medicine_id: '', batch_no: '', expiry_date: '', mfg_date: '', qty: '', purchase_price: '', sale_price: '', location: 'store', notes: '' };
const todayStr = () => new Date().toISOString().slice(0, 10);

function expiryStatus(expiry: string): 'expired' | 'near' | 'ok' {
  const days = (new Date(expiry).getTime() - new Date(todayStr()).getTime()) / 86400000;
  if (days < 0) return 'expired';
  if (days <= 60) return 'near';
  return 'ok';
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q) sp.set('q', q);
      if (statusFilter) sp.set('status', statusFilter);
      const [b, m] = await Promise.all([
        api.get(`/api/pharmacy/batches?${sp.toString()}`),
        api.get('/api/pharmacy/medicines?all=1'),
      ]);
      setBatches(b.batches || []);
      setMedicines(m.medicines || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, statusFilter]);

  function openCreate() { setForm(empty); setEditId(null); setShowForm(true); }
  function openEdit(b: Batch) {
    setForm({ medicine_id: String(b.medicine_id), batch_no: b.batch_no, expiry_date: b.expiry_date, mfg_date: b.mfg_date || '', qty: String(b.qty), purchase_price: String(b.purchase_price), sale_price: String(b.sale_price), location: b.location, notes: b.notes || '' });
    setEditId(b.id); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editId) {
        await api.put(`/api/pharmacy/batches/${editId}`, {
          batch_no: form.batch_no, expiry_date: form.expiry_date, mfg_date: form.mfg_date || null,
          purchase_price: Number(form.purchase_price), sale_price: Number(form.sale_price), notes: form.notes,
        });
      } else {
        await api.post('/api/pharmacy/batches', {
          medicine_id: Number(form.medicine_id), batch_no: form.batch_no, expiry_date: form.expiry_date,
          mfg_date: form.mfg_date || null, qty: Number(form.qty), purchase_price: Number(form.purchase_price),
          sale_price: Number(form.sale_price), location: form.location, notes: form.notes,
        });
      }
      setShowForm(false); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(b: Batch) {
    if (!confirm(`Remove batch ${b.batch_no} of ${b.medicine_name}?`)) return;
    try { await api.delete(`/api/pharmacy/batches/${b.id}`); load(); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Batches &amp; Expiry</h1>
          <p className="text-sm text-gray-500 mt-1">Track batch numbers, expiry dates, and near-expiry stock.</p>
        </div>
        <button onClick={openCreate} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>Add Opening Batch</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">{editId ? 'Edit Batch' : 'Add Opening Batch'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="kmc-label">Medicine *</label>
              <select className="kmc-input" value={form.medicine_id} disabled={!!editId} onChange={e => setForm({...form, medicine_id: e.target.value})} required>
                <option value="">Select medicine...</option>
                {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="kmc-label">Batch No. *</label>
              <input className="kmc-input" value={form.batch_no} onChange={e => setForm({...form, batch_no: e.target.value})} required/>
            </div>
            <div>
              <label className="kmc-label">Expiry Date *</label>
              <input type="date" className="kmc-input" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} required/>
            </div>
            <div>
              <label className="kmc-label">Manufacturing Date</label>
              <input type="date" className="kmc-input" value={form.mfg_date} onChange={e => setForm({...form, mfg_date: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Quantity {editId ? '(fixed after creation)' : '*'}</label>
              <input type="number" min="0" disabled={!!editId} className="kmc-input font-mono-num" value={form.qty} onChange={e => setForm({...form, qty: e.target.value})} required/>
            </div>
            <div>
              <label className="kmc-label">Location {editId ? '(fixed after creation)' : ''}</label>
              <select className="kmc-input" disabled={!!editId} value={form.location} onChange={e => setForm({...form, location: e.target.value})}>
                <option value="store">Store</option>
                <option value="pharmacy">Pharmacy Counter</option>
              </select>
            </div>
            <div>
              <label className="kmc-label">Purchase Price (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={form.purchase_price} onChange={e => setForm({...form, purchase_price: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Sale Price (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={form.sale_price} onChange={e => setForm({...form, sale_price: e.target.value})}/>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="kmc-label">Notes</label>
              <input className="kmc-input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}/>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Batch'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="kmc-input pl-9" placeholder="Search by medicine or batch no..." value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <select className="kmc-input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All batches</option>
          <option value="near_expiry">Near expiry (60 days)</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Medicine','Batch No.','Expiry','Qty','Location','Purchase','Sale Price','Actions'].map(h =>
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && batches.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No batches found.</td></tr>}
            {batches.map(b => {
              const status = expiryStatus(b.expiry_date);
              return (
                <tr key={b.id} className={`border-b border-gray-50 last:border-0 ${status === 'expired' ? 'bg-crimson-50/40' : status === 'near' ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-3 font-medium text-navy-900">{b.medicine_name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.batch_no}</td>
                  <td className={`px-4 py-3 font-mono-num ${status === 'expired' ? 'text-crimson-700 font-semibold' : status === 'near' ? 'text-amber-700 font-semibold' : 'text-gray-600'}`}>
                    {b.expiry_date}
                    {status !== 'ok' && <AlertTriangle size={12} className="inline ml-1"/>}
                  </td>
                  <td className="px-4 py-3 font-mono-num text-gray-700">{b.qty} {b.unit}</td>
                  <td className="px-4 py-3"><span className="kmc-badge bg-navy-50 text-navy-700 capitalize">{b.location}</span></td>
                  <td className="px-4 py-3 font-mono-num text-gray-600">Rs. {b.purchase_price}</td>
                  <td className="px-4 py-3 font-mono-num font-semibold text-navy-900">Rs. {b.sale_price}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(b)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"><Pencil size={13}/></button>
                      {b.supplier_id && (
                        <a href={`/dashboard/pharmacy/purchase-returns?batch_id=${b.id}`} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 px-1 self-center">Return</a>
                      )}
                      <button onClick={() => handleDelete(b)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
