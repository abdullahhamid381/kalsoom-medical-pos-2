'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api-client';

const emptyForm = { full_name: '', phone: '', cnic: '', age: '', gender: 'Other', address: '' };

export default function PatientsListPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load(activeRef?: { current: boolean }) {
    setLoading(true);
    try {
      const data = await api.get(`/api/patients${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
      if (!activeRef || activeRef.current) setPatients(data.patients || []);
    } catch (err: any) {
      if (!activeRef || activeRef.current) setError(err.message);
    } finally {
      if (!activeRef || activeRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    const activeRef = { current: true };
    const t = setTimeout(() => load(activeRef), 200);
    return () => {
      activeRef.current = false;
      clearTimeout(t);
    };
  }, [q]);

  function openEdit(p: any) {
    setForm({
      full_name: p.full_name,
      phone: p.phone,
      cnic: p.cnic || '',
      age: p.age ? String(p.age) : '',
      gender: p.gender || 'Other',
      address: p.address || ''
    });
    setEditingId(p.id);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/api/patients/${editingId}`, { ...form, age: form.age ? Number(form.age) : undefined });
      setEditingId(null);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: any) {
    if (!confirm(`Delete ${p.full_name}? This only works if they have no appointments or other visit records.`)) return;
    try {
      await api.delete(`/api/patients/${p.id}`);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Patients</h1>
          <p className="text-sm text-gray-500 mt-1">Search patient records and view their visit history.</p>
        </div>
        <a href="/dashboard/appointments/new" className="kmc-btn-accent flex items-center gap-2">
          <UserPlus size={16} /> Book New Patient
        </a>
      </div>

      <div className="kmc-card p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="kmc-input pl-9 max-w-md"
            placeholder="Search by name, phone or CNIC..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {editingId && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Edit Patient</h2>
            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-crimson-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="kmc-label">Full Name *</label>
              <input
                className="kmc-input"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="kmc-label">Phone *</label>
              <input
                className="kmc-input font-mono-num"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="kmc-label">CNIC</label>
              <input
                className="kmc-input font-mono-num"
                value={form.cnic}
                onChange={(e) => setForm({ ...form, cnic: e.target.value })}
              />
            </div>
            <div>
              <label className="kmc-label">Age</label>
              <input
                type="number"
                min="0"
                className="kmc-input font-mono-num"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
              />
            </div>
            <div>
              <label className="kmc-label">Gender</label>
              <select className="kmc-input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="kmc-label">Address</label>
              <input className="kmc-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingId(null)} className="kmc-btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Phone</th>
              <th className="px-5 py-3 font-semibold">CNIC</th>
              <th className="px-5 py-3 font-semibold">Age / Gender</th>
              <th className="px-5 py-3 font-semibold">Registered</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && patients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                  No patients found.
                </td>
              </tr>
            )}
            {patients.map((p) => (
              <tr
                key={p.id}
                className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                onClick={() => router.push(`/dashboard/patients/${p.id}`)}
              >
                <td className="px-5 py-3 font-medium text-navy-900">{p.full_name}</td>
                <td className="px-5 py-3 font-mono-num text-gray-700">{p.phone}</td>
                <td className="px-5 py-3 font-mono-num text-gray-500 text-xs">{p.cnic || '—'}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {p.age ? `${p.age} yrs` : '—'} {p.gender ? `• ${p.gender}` : ''}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(p)}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"
                    >
                      <Trash2 size={14} />
                    </button>
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
