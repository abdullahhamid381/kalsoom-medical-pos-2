'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, X, Pencil, Trash2, Search, FlaskConical } from 'lucide-react';
import { api } from '@/lib/api-client';

type Test = { id: number; name: string; category: string | null; price: number; turnaround: string; description: string | null; active: number; default_sample_type?: string; is_culture?: number };
const empty = { name: '', category: '', price: '', turnaround: '24 hours', description: '', default_sample_type: 'blood', is_culture: false };
const SAMPLE_TYPES = ['blood', 'urine', 'stool', 'swab', 'sputum', 'other'];

export default function LabTestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
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
      const data = await api.get(`/api/lab/tests?${q ? `q=${encodeURIComponent(q)}&` : ''}${showAll ? 'all=1' : ''}`);
      setTests(data.tests || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, showAll]);

  function openCreate() { setForm(empty); setEditId(null); setShowForm(true); }
  function openEdit(t: Test) {
    setForm({ name: t.name, category: t.category || '', price: String(t.price), turnaround: t.turnaround, description: t.description || '', default_sample_type: t.default_sample_type || 'blood', is_culture: !!t.is_culture });
    setEditId(t.id); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, price: Number(form.price) };
      if (editId) await api.put(`/api/lab/tests/${editId}`, payload);
      else await api.post('/api/lab/tests', payload);
      setShowForm(false); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(t: Test) {
    if (!confirm(`Remove "${t.name}"?`)) return;
    try { await api.delete(`/api/lab/tests/${t.id}`); load(); }
    catch (e: any) { setError(e.message); }
  }

  async function toggleActive(t: Test) {
    try { await api.put(`/api/lab/tests/${t.id}`, { active: !t.active }); load(); }
    catch (e: any) { setError(e.message); }
  }

  // Group by category for display
  const grouped = tests.reduce((acc: Record<string, Test[]>, t) => {
    const key = t.category || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Lab Tests</h1>
          <p className="text-sm text-gray-500 mt-1">Manage available tests, prices and turnaround times.</p>
        </div>
        <button onClick={openCreate} className="kmc-btn-accent flex items-center gap-2"><Plus size={16} /> Add Test</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">{editId ? 'Edit Test' : 'Add Test'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="kmc-label">Test Name *</label><input className="kmc-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label className="kmc-label">Category</label><input className="kmc-input" placeholder="e.g. Haematology, Biochemistry" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
            <div><label className="kmc-label">Price (Rs.) *</label><input type="number" min="0" className="kmc-input font-mono-num" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required /></div>
            <div><label className="kmc-label">Turnaround Time</label><input className="kmc-input" placeholder="e.g. 2 hours, Same day" value={form.turnaround} onChange={e => setForm({ ...form, turnaround: e.target.value })} /></div>
            <div><label className="kmc-label">Sample Type</label>
              <select className="kmc-input" value={form.default_sample_type} onChange={e => setForm({ ...form, default_sample_type: e.target.value })}>
                {SAMPLE_TYPES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="kmc-label">Description / Sample Required</label><input className="kmc-input" placeholder="e.g. 5ml blood (EDTA tube)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.is_culture} onChange={e => setForm({ ...form, is_culture: e.target.checked })} className="rounded" />
                Microbiology culture &amp; sensitivity test
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Test'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="kmc-input pl-9" placeholder="Search by name or category..." value={q} onChange={e => setQ(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" />Show inactive</label>
      </div>

      {loading ? <div className="kmc-card p-8 text-center text-gray-400">Loading...</div> : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="kmc-card">
            <div className="px-5 py-3 border-b border-gray-100 bg-mist/60 rounded-t-2xl">
              <h3 className="font-display font-semibold text-navy-900 text-sm">{category}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                  {['Test Name','Price','Turnaround','Description','Status','Actions'].map(h => <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {items.map(t => (
                    <tr key={t.id} className={`border-b border-gray-50 last:border-0 ${!t.active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3 font-medium text-navy-900">{t.name}</td>
                      <td className="px-5 py-3 font-mono-num font-semibold text-navy-800">Rs. {t.price}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{t.turnaround}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{t.description || '—'}</td>
                      <td className="px-5 py-3"><span className={`kmc-badge ${t.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>{t.active ? 'active' : 'inactive'}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5">
                          <Link href={`/dashboard/lab/tests/${t.id}/ranges`} title="Reference ranges" className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"><FlaskConical size={13} /></Link>
                          <button onClick={() => openEdit(t)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"><Pencil size={13} /></button>
                          <button onClick={() => toggleActive(t)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 px-1">{t.active ? 'Deactivate' : 'Activate'}</button>
                          <button onClick={() => handleDelete(t)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
