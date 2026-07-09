'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api-client';

type Doctor = {
  id: number;
  name: string;
  specialization: string;
  department: string;
  fee: number;
  availability: string;
  phone: string | null;
  description: string | null;
  active: number;
};

const emptyForm = { name: '', specialization: '', department: '', fee: '', availability: 'Mon-Sat, 9:00 AM - 5:00 PM', phone: '', description: '' };

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/api/doctors');
      setDoctors(data.doctors || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(d: Doctor) {
    setForm({
      name: d.name,
      specialization: d.specialization,
      department: d.department,
      fee: String(d.fee),
      availability: d.availability,
      phone: d.phone || '',
      description: d.description || ''
    });
    setEditingId(d.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, fee: Number(form.fee || 0) };
      if (editingId) {
        await api.put(`/api/doctors/${editingId}`, payload);
      } else {
        await api.post('/api/doctors', payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Doctor) {
    try {
      await api.put(`/api/doctors/${d.id}`, { active: !d.active });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(d: Doctor) {
    if (!confirm(`Remove ${d.name}? If they have existing appointments they will be deactivated instead.`)) return;
    try {
      await api.delete(`/api/doctors/${d.id}`);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Doctors</h1>
          <p className="text-sm text-gray-500 mt-1">Manage the doctor roster, fees and availability.</p>
        </div>
        <button onClick={openCreate} className="kmc-btn-accent flex items-center gap-2">
          <Plus size={16} /> Add Doctor
        </button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">{editingId ? 'Edit Doctor' : 'Add Doctor'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="kmc-label">Name *</label>
              <input className="kmc-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="kmc-label">Specialization *</label>
              <input
                className="kmc-input"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="kmc-label">Department</label>
              <input className="kmc-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className="kmc-label">Consultation Fee (Rs.)</label>
              <input
                type="number"
                min="0"
                className="kmc-input font-mono-num"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
              />
            </div>
            <div>
              <label className="kmc-label">Availability</label>
              <input className="kmc-input" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} />
            </div>
            <div>
              <label className="kmc-label">Phone</label>
              <input className="kmc-input font-mono-num" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="kmc-label">Doctor Description (bio, qualifications, experience)</label>
              <textarea
                className="kmc-input"
                rows={3}
                placeholder="e.g. MBBS, FCPS — 15+ years experience in General Medicine. Specialist in..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Doctor'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && doctors.length === 0 && <p className="text-gray-400 text-sm">No doctors added yet.</p>}
        {doctors.map((d) => (
          <div key={d.id} className={`kmc-card p-5 ${!d.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
                  <Stethoscope size={18} />
                </div>
                <div>
                  <p className="font-semibold text-navy-900">{d.name}</p>
                  <p className="text-xs text-gray-500">{d.specialization}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(d)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(d)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              <p>Department: {d.department}</p>
              <p>Fee: Rs. {d.fee}</p>
              <p>Availability: {d.availability}</p>
              {d.phone && <p>Phone: {d.phone}</p>}
              {d.description && (
                <p className="text-gray-600 italic mt-1.5 border-t border-gray-100 pt-1.5">"{d.description}"</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`kmc-badge ${d.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                {d.active ? 'active' : 'inactive'}
              </span>
              <button onClick={() => toggleActive(d)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600">
                {d.active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
