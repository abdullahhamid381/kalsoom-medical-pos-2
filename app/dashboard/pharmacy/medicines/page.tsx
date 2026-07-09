'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, AlertTriangle, Search } from 'lucide-react';
import { api } from '@/lib/api-client';

type Medicine = {
  id: number; name: string; generic_name: string | null; category: string | null;
  unit: string; purchase_price: number; sale_price: number;
  stock_qty: number; low_stock_at: number; manufacturer: string | null; active: number;
  prescription_required: number;
};

const empty = { name:'', generic_name:'', category:'', unit:'tablet', purchase_price:'', sale_price:'', stock_qty:'', low_stock_at:'10', manufacturer:'', prescription_required: false };

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/api/pharmacy/medicines?${q ? `q=${encodeURIComponent(q)}&` : ''}${showAll ? 'all=1' : ''}`);
      setMedicines(data.medicines || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, showAll]);

  function openCreate() { setForm(empty); setEditId(null); setShowForm(true); }
  function openEdit(m: Medicine) {
    setForm({ name: m.name, generic_name: m.generic_name||'', category: m.category||'', unit: m.unit, purchase_price: String(m.purchase_price), sale_price: String(m.sale_price), stock_qty: String(m.stock_qty), low_stock_at: String(m.low_stock_at), manufacturer: m.manufacturer||'', prescription_required: !!m.prescription_required });
    setEditId(m.id); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, purchase_price: Number(form.purchase_price), sale_price: Number(form.sale_price), stock_qty: Number(form.stock_qty), low_stock_at: Number(form.low_stock_at) };
      if (editId) await api.put(`/api/pharmacy/medicines/${editId}`, payload);
      else await api.post('/api/pharmacy/medicines', payload);
      setShowForm(false); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(m: Medicine) {
    if (!confirm(`Remove ${m.name}?`)) return;
    try { await api.delete(`/api/pharmacy/medicines/${m.id}`); load(); }
    catch (e: any) { setError(e.message); }
  }

  async function toggleActive(m: Medicine) {
    try { await api.put(`/api/pharmacy/medicines/${m.id}`, { active: !m.active }); load(); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Medicine Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Add medicines, set prices, manage stock levels.</p>
        </div>
        <button onClick={openCreate} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>Add Medicine</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">{editId ? 'Edit Medicine' : 'Add Medicine'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="kmc-label">Medicine Name *</label>
              <input className="kmc-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
            </div>
            <div>
              <label className="kmc-label">Generic Name</label>
              <input className="kmc-input" value={form.generic_name} onChange={e => setForm({...form, generic_name: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Category</label>
              <input className="kmc-input" placeholder="e.g. Antibiotic, Painkiller" value={form.category} onChange={e => setForm({...form, category: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Unit</label>
              <select className="kmc-input" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                {['tablet','capsule','syrup (ml)','injection','sachet','cream (g)','drops','strip','bottle','piece'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="kmc-label">Purchase Price (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={form.purchase_price} onChange={e => setForm({...form, purchase_price: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Sale Price (Rs.) *</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={form.sale_price} onChange={e => setForm({...form, sale_price: e.target.value})} required/>
            </div>
            <div>
              <label className="kmc-label">Current Stock (qty)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={form.stock_qty} onChange={e => setForm({...form, stock_qty: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Low Stock Alert At</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={form.low_stock_at} onChange={e => setForm({...form, low_stock_at: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Manufacturer</label>
              <input className="kmc-input" value={form.manufacturer} onChange={e => setForm({...form, manufacturer: e.target.value})}/>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.prescription_required} onChange={e => setForm({...form, prescription_required: e.target.checked})} className="rounded"/>
                Prescription required
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Medicine'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="kmc-input pl-9" placeholder="Search by name, generic name or category..." value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded"/>
          Show inactive
        </label>
      </div>

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Name','Generic','Category','Unit','Purchase','Sale Price','Stock','Status','Actions'].map(h =>
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && medicines.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">No medicines found.</td></tr>}
            {medicines.map(m => (
              <tr key={m.id} className={`border-b border-gray-50 last:border-0 ${!m.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-navy-900">
                  {m.name}
                  {m.stock_qty <= m.low_stock_at && m.active ? <AlertTriangle size={12} className="inline ml-1 text-amber-500"/> : null}
                  {m.prescription_required ? <span className="kmc-badge bg-navy-50 text-navy-700 ml-1.5 align-middle">Rx</span> : null}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{m.generic_name || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{m.category || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{m.unit}</td>
                <td className="px-4 py-3 font-mono-num text-gray-600">Rs. {m.purchase_price}</td>
                <td className="px-4 py-3 font-mono-num font-semibold text-navy-900">Rs. {m.sale_price}</td>
                <td className={`px-4 py-3 font-mono-num font-semibold ${m.stock_qty <= m.low_stock_at ? 'text-amber-600' : 'text-emerald-700'}`}>
                  {m.stock_qty} {m.unit}
                </td>
                <td className="px-4 py-3">
                  <span className={`kmc-badge ${m.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>{m.active ? 'active' : 'inactive'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(m)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"><Pencil size={13}/></button>
                    <button onClick={() => toggleActive(m)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 px-1">{m.active ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => handleDelete(m)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
