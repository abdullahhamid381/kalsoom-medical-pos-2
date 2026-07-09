'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, Search } from 'lucide-react';
import { api } from '@/lib/api-client';

type Supplier = {
  id: number; name: string; contact_person: string | null; phone: string | null;
  email: string | null; address: string | null; active: number;
};

const empty = { name: '', contact_person: '', phone: '', email: '', address: '', notes: '' };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
      const data = await api.get(`/api/pharmacy/suppliers?${q ? `q=${encodeURIComponent(q)}&` : ''}${showAll ? 'all=1' : ''}`);
      setSuppliers(data.suppliers || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, showAll]);

  function openCreate() { setForm(empty); setEditId(null); setShowForm(true); }
  function openEdit(s: Supplier) {
    setForm({ name: s.name, contact_person: s.contact_person||'', phone: s.phone||'', email: s.email||'', address: s.address||'', notes: '' });
    setEditId(s.id); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editId) await api.put(`/api/pharmacy/suppliers/${editId}`, form);
      else await api.post('/api/pharmacy/suppliers', form);
      setShowForm(false); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(s: Supplier) {
    if (!confirm(`Remove supplier ${s.name}?`)) return;
    try { await api.delete(`/api/pharmacy/suppliers/${s.id}`); load(); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage medicine suppliers and their ledgers.</p>
        </div>
        <button onClick={openCreate} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>Add Supplier</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">{editId ? 'Edit Supplier' : 'Add Supplier'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="kmc-label">Supplier Name *</label>
              <input className="kmc-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
            </div>
            <div>
              <label className="kmc-label">Contact Person</label>
              <input className="kmc-input" value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Phone</label>
              <input className="kmc-input font-mono-num" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Email</label>
              <input type="email" className="kmc-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/>
            </div>
            <div className="sm:col-span-2">
              <label className="kmc-label">Address</label>
              <input className="kmc-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})}/>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Supplier'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="kmc-input pl-9" placeholder="Search by name, contact or phone..." value={q} onChange={e => setQ(e.target.value)}/>
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
              {['Name','Contact','Phone','Email','Status','Actions'].map(h =>
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && suppliers.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No suppliers found.</td></tr>}
            {suppliers.map(s => (
              <tr key={s.id} className={`border-b border-gray-50 last:border-0 ${!s.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-navy-900 hover:text-crimson-600 cursor-pointer" onClick={() => window.location.href = `/dashboard/pharmacy/suppliers/${s.id}`}>{s.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{s.contact_person || '—'}</td>
                <td className="px-4 py-3 font-mono-num text-gray-600">{s.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{s.email || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`kmc-badge ${s.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>{s.active ? 'active' : 'inactive'}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(s)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"><Pencil size={13}/></button>
                    <button onClick={() => handleDelete(s)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"><Trash2 size={13}/></button>
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
