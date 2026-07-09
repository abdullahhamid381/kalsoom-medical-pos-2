'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, Search } from 'lucide-react';
import { api } from '@/lib/api-client';

type Test = { id: number; name: string; category: string | null };
type Panel = {
  id: number; name: string; category: string | null; price: number; turnaround: string;
  description: string | null; active: number; member_tests: Test[];
};
const empty = { name: '', category: '', price: '', turnaround: '24 hours', description: '' };

export default function LabPanelsPage() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [allTests, setAllTests] = useState<Test[]>([]);
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/api/lab/panels?${q ? `q=${encodeURIComponent(q)}&` : ''}${showAll ? 'all=1' : ''}`);
      setPanels(data.panels || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, showAll]);
  useEffect(() => { api.get('/api/lab/tests?all=1').then(d => setAllTests(d.tests || [])).catch(() => {}); }, []);

  function openCreate() { setForm(empty); setEditId(null); setMemberIds([]); setShowForm(true); }
  function openEdit(p: Panel) {
    setForm({ name: p.name, category: p.category || '', price: String(p.price), turnaround: p.turnaround, description: p.description || '' });
    setMemberIds(p.member_tests.map(t => t.id));
    setEditId(p.id); setShowForm(true);
  }

  function toggleMember(id: number) {
    setMemberIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, price: Number(form.price), member_test_ids: memberIds };
      if (editId) await api.put(`/api/lab/panels/${editId}`, payload);
      else await api.post('/api/lab/panels', payload);
      setShowForm(false); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(p: Panel) {
    if (!confirm(`Remove "${p.name}"?`)) return;
    try { await api.delete(`/api/lab/panels/${p.id}`); load(); }
    catch (e: any) { setError(e.message); }
  }

  async function toggleActive(p: Panel) {
    try { await api.put(`/api/lab/panels/${p.id}`, { active: !p.active }); load(); }
    catch (e: any) { setError(e.message); }
  }

  const filteredMembers = testSearch.trim()
    ? allTests.filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Lab Panels</h1>
          <p className="text-sm text-gray-500 mt-1">Bundle multiple tests (e.g. CBC, LFT) under a single order line and price.</p>
        </div>
        <button onClick={openCreate} className="kmc-btn-accent flex items-center gap-2"><Plus size={16} /> Add Panel</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">{editId ? 'Edit Panel' : 'Add Panel'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className="kmc-label">Panel Name *</label><input className="kmc-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="kmc-label">Category</label><input className="kmc-input" placeholder="e.g. Haematology" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
              <div><label className="kmc-label">Bundle Price (Rs.) *</label><input type="number" min="0" className="kmc-input font-mono-num" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required /></div>
              <div><label className="kmc-label">Turnaround Time</label><input className="kmc-input" value={form.turnaround} onChange={e => setForm({ ...form, turnaround: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="kmc-label">Description</label><input className="kmc-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>

            <div>
              <label className="kmc-label">Member Tests *</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="kmc-input pl-9" placeholder="Search tests to add..." value={testSearch} onChange={e => setTestSearch(e.target.value)} />
                {filteredMembers.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full kmc-card shadow-pop max-h-52 overflow-y-auto">
                    {filteredMembers.map(t => (
                      <button key={t.id} type="button" onClick={() => { toggleMember(t.id); setTestSearch(''); }}
                        className="w-full text-left px-4 py-2 hover:bg-mist border-b border-gray-50 last:border-0 text-sm">
                        {t.name} <span className="text-xs text-gray-400">({t.category || 'General'})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {memberIds.map(id => {
                  const t = allTests.find(x => x.id === id);
                  if (!t) return null;
                  return (
                    <span key={id} className="kmc-badge bg-navy-50 text-navy-800 flex items-center gap-1.5">
                      {t.name}
                      <button type="button" onClick={() => toggleMember(id)} className="hover:text-crimson-600"><X size={11} /></button>
                    </span>
                  );
                })}
                {memberIds.length === 0 && <span className="text-xs text-gray-400">No member tests selected yet.</span>}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Panel'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="kmc-input pl-9" placeholder="Search by name or category..." value={q} onChange={e => setQ(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" />Show inactive</label>
      </div>

      {loading ? <div className="kmc-card p-8 text-center text-gray-400">Loading...</div> : (
        <div className="kmc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                {['Panel', 'Member Tests', 'Price', 'Status', 'Actions'].map(h => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {panels.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No panels yet.</td></tr>}
                {panels.map(p => (
                  <tr key={p.id} className={`border-b border-gray-50 last:border-0 ${!p.active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-navy-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.category || 'General'}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">{p.member_tests.map(t => t.name).join(', ') || '—'}</td>
                    <td className="px-5 py-3 font-mono-num font-semibold text-navy-800">Rs. {p.price}</td>
                    <td className="px-5 py-3"><span className={`kmc-badge ${p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>{p.active ? 'active' : 'inactive'}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"><Pencil size={13} /></button>
                        <button onClick={() => toggleActive(p)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 px-1">{p.active ? 'Deactivate' : 'Activate'}</button>
                        <button onClick={() => handleDelete(p)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
