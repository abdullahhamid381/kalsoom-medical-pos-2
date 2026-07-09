'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';

type Range = {
  id: number; gender: string; age_min: number; age_max: number; value_type: 'numeric' | 'text';
  low: number | null; high: number | null; unit: string | null; normal_text: string | null;
  critical_low: number | null; critical_high: number | null; notes: string | null;
};

const empty = {
  gender: 'any', age_min: '0', age_max: '150', value_type: 'numeric' as 'numeric' | 'text',
  low: '', high: '', unit: '', normal_text: '', critical_low: '', critical_high: '', notes: ''
};

export default function TestRangesPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id as string;
  const [testName, setTestName] = useState('');
  const [ranges, setRanges] = useState<Range[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [testsData, rangesData] = await Promise.all([
        api.get('/api/lab/tests?all=1'),
        api.get(`/api/lab/tests/${testId}/ranges`)
      ]);
      const test = (testsData.tests || []).find((t: any) => String(t.id) === testId);
      setTestName(test?.name || `Test #${testId}`);
      setRanges(rangesData.ranges || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [testId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.post(`/api/lab/tests/${testId}/ranges`, form);
      setShowForm(false); setForm(empty); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this reference range?')) return;
    try { await api.delete(`/api/lab/ranges/${id}`); load(); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button onClick={() => router.push('/dashboard/lab/tests')} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5">
        <ArrowLeft size={15} /> Back to tests
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Reference Ranges — {testName}</h1>
          <p className="text-sm text-gray-500 mt-1">Age/gender-specific normal values used to auto-flag results as low, high or critical.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="kmc-btn-accent flex items-center gap-2"><Plus size={16} /> Add Range</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Add Reference Range</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18} /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="kmc-label">Gender</label>
              <select className="kmc-input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option value="any">Any</option><option value="male">Male</option><option value="female">Female</option>
              </select>
            </div>
            <div><label className="kmc-label">Age Min (yrs)</label><input type="number" className="kmc-input" value={form.age_min} onChange={e => setForm({ ...form, age_min: e.target.value })} /></div>
            <div><label className="kmc-label">Age Max (yrs)</label><input type="number" className="kmc-input" value={form.age_max} onChange={e => setForm({ ...form, age_max: e.target.value })} /></div>

            <div><label className="kmc-label">Value Type</label>
              <select className="kmc-input" value={form.value_type} onChange={e => setForm({ ...form, value_type: e.target.value as any })}>
                <option value="numeric">Numeric</option><option value="text">Text (e.g. culture, microbiology)</option>
              </select>
            </div>

            {form.value_type === 'numeric' ? (
              <>
                <div><label className="kmc-label">Low</label><input type="number" step="any" className="kmc-input font-mono-num" value={form.low} onChange={e => setForm({ ...form, low: e.target.value })} /></div>
                <div><label className="kmc-label">High</label><input type="number" step="any" className="kmc-input font-mono-num" value={form.high} onChange={e => setForm({ ...form, high: e.target.value })} /></div>
                <div><label className="kmc-label">Unit</label><input className="kmc-input" placeholder="e.g. mg/dL" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
                <div><label className="kmc-label">Critical Low</label><input type="number" step="any" className="kmc-input font-mono-num" value={form.critical_low} onChange={e => setForm({ ...form, critical_low: e.target.value })} /></div>
                <div><label className="kmc-label">Critical High</label><input type="number" step="any" className="kmc-input font-mono-num" value={form.critical_high} onChange={e => setForm({ ...form, critical_high: e.target.value })} /></div>
              </>
            ) : (
              <div className="sm:col-span-2"><label className="kmc-label">Normal Result Text</label><input className="kmc-input" placeholder="e.g. Negative" value={form.normal_text} onChange={e => setForm({ ...form, normal_text: e.target.value })} /></div>
            )}

            <div className="sm:col-span-3"><label className="kmc-label">Notes</label><input className="kmc-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="sm:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : 'Add Range'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="kmc-card p-8 text-center text-gray-400">Loading...</div> : (
        <div className="kmc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                {['Gender', 'Age Band', 'Type', 'Range', 'Critical', 'Actions'].map(h => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {ranges.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No reference ranges defined yet.</td></tr>}
                {ranges.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 capitalize text-navy-900">{r.gender}</td>
                    <td className="px-5 py-3 text-gray-500">{r.age_min}–{r.age_max} yrs</td>
                    <td className="px-5 py-3 text-gray-500 capitalize">{r.value_type}</td>
                    <td className="px-5 py-3 font-mono-num text-navy-800">
                      {r.value_type === 'text' ? (r.normal_text || '—') : `${r.low ?? '—'} - ${r.high ?? '—'} ${r.unit || ''}`}
                    </td>
                    <td className="px-5 py-3 text-xs text-crimson-600">
                      {r.critical_low != null || r.critical_high != null ? `<${r.critical_low ?? '—'} / >${r.critical_high ?? '—'}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => handleDelete(r.id)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"><Trash2 size={13} /></button>
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
