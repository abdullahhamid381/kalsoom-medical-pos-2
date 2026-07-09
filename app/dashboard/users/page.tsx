'use client';

import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, ShieldCheck, UserCircle, Stethoscope, FlaskConical } from 'lucide-react';
import { api } from '@/lib/api-client';

type StaffUser = {
  id: number;
  name: string;
  username: string;
  role: 'super_admin' | 'receptionist' | 'doctor';
  doctor_id: number | null;
  doctor_name: string | null;
  active: number;
  created_at: string;
};

type Doctor = { id: number; name: string; specialization: string };

const emptyForm = {
  name: '',
  username: '',
  password: '',
  role: 'receptionist' as 'super_admin' | 'receptionist' | 'doctor',
  doctor_id: '' as number | ''
};

const ROLE_LABELS = { super_admin: 'Super Admin', receptionist: 'Receptionist', doctor: 'Doctor', pharmacy_admin: 'Pharmacy Admin', sales_person: 'Sales Person', lab_technician: 'Lab Technician', ward_admin: 'Ward Admin', lab_senior_technologist: 'Lab Senior Technologist', lab_pathologist: 'Lab Pathologist' };
const ROLE_ICONS: Record<string, any> = { super_admin: ShieldCheck, receptionist: UserCircle, doctor: Stethoscope, pharmacy_admin: FlaskConical, sales_person: UserCircle, lab_technician: UserCircle, ward_admin: UserCircle, lab_senior_technologist: FlaskConical, lab_pathologist: FlaskConical };
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-crimson-100 text-crimson-800',
  receptionist: 'bg-navy-100 text-navy-800',
  doctor: 'bg-sky-100 text-sky-800',
  pharmacy_admin: 'bg-purple-100 text-purple-800',
  sales_person: 'bg-emerald-100 text-emerald-800',
  lab_technician: 'bg-indigo-100 text-indigo-800',
  ward_admin: 'bg-teal-100 text-teal-800',
  lab_senior_technologist: 'bg-indigo-100 text-indigo-800',
  lab_pathologist: 'bg-indigo-100 text-indigo-800'
};

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
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
      const [usersData, doctorsData] = await Promise.all([
        api.get('/api/users'),
        api.get('/api/doctors')
      ]);
      setUsers(usersData.users || []);
      setDoctors((doctorsData.doctors || []).filter((d: any) => d.active));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(u: StaffUser) {
    setForm({
      name: u.name,
      username: u.username,
      password: '',
      role: u.role,
      doctor_id: u.doctor_id ?? ''
    });
    setEditingId(u.id);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const payload: any = { name: form.name, role: form.role };
        if (form.role === 'doctor') payload.doctor_id = form.doctor_id;
        if (form.password.trim()) payload.password = form.password;
        await api.put(`/api/users/${editingId}`, payload);
      } else {
        const payload: any = { ...form };
        if (form.role !== 'doctor') delete payload.doctor_id;
        await api.post('/api/users', payload);
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: StaffUser) {
    try {
      await api.put(`/api/users/${u.id}`, { active: !u.active });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(u: StaffUser) {
    if (!confirm(`Remove ${u.name}? If they have booking history they will be deactivated instead of deleted.`)) return;
    try {
      await api.delete(`/api/users/${u.id}`);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Staff Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create receptionist accounts, admin access, and doctor portal logins. A doctor login is linked to one
            doctor record — that doctor then sees only their own patient list and revenue.
          </p>
        </div>
        <button onClick={openCreate} className="kmc-btn-accent flex items-center gap-2">
          <Plus size={16} /> Add User
        </button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">{editingId ? 'Edit User' : 'Add User'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="kmc-label">Full Name *</label>
              <input
                className="kmc-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="kmc-label">Username *</label>
              <input
                className="kmc-input font-mono-num"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                disabled={!!editingId}
              />
            </div>
            <div>
              <label className="kmc-label">{editingId ? 'New Password (leave blank to keep)' : 'Password *'}</label>
              <input
                type="password"
                className="kmc-input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editingId}
                minLength={6}
              />
            </div>
            <div>
              <label className="kmc-label">Role</label>
              <select
                className="kmc-input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as any, doctor_id: '' })}
              >
                <option value="receptionist">Receptionist</option>
                <option value="doctor">Doctor (portal login)</option>
              <option value="pharmacy_admin">Pharmacy Admin (stock + sales + reports)</option>
              <option value="sales_person">Sales Person (pharmacy sales only)</option>
              <option value="lab_technician">Lab Technician (enters results)</option>
              <option value="lab_senior_technologist">Lab Senior Technologist (reviews results)</option>
              <option value="lab_pathologist">Lab Pathologist (signs off reports)</option>
              <option value="ward_admin">Ward Admin (IPD admissions + rooms)</option>
              <option value="sales_person">Sales Person (sales only)</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            {form.role === 'doctor' && (
              <div className="sm:col-span-2">
                <label className="kmc-label">Link to Doctor *</label>
                <select
                  className="kmc-input"
                  value={form.doctor_id}
                  onChange={(e) => setForm({ ...form, doctor_id: Number(e.target.value) })}
                  required
                >
                  <option value="">Select a doctor to link this login to...</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.specialization}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  This doctor will log in with the username/password above and only see their own appointments,
                  patients, and revenue.
                </p>
              </div>
            )}

            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add User'}
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
              <th className="px-5 py-3 font-semibold">Username</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Doctor Link</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td>
              </tr>
            )}
            {users.map((u) => {
              const Icon = ROLE_ICONS[u.role] || UserCircle;
              return (
                <tr key={u.id} className={`border-b border-gray-50 last:border-0 ${!u.active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-navy-900">
                    <span className="flex items-center gap-2">
                      <Icon
                        size={14}
                        className={
                          u.role === 'super_admin'
                            ? 'text-crimson-600'
                            : u.role === 'doctor'
                            ? 'text-sky-600'
                            : 'text-gray-400'
                        }
                      />
                      {u.name}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono-num text-gray-700">{u.username}</td>
                  <td className="px-5 py-3">
                    <span className={`kmc-badge ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {u.doctor_name ? (
                      <span className="flex items-center gap-1">
                        <Stethoscope size={11} className="text-sky-500" /> {u.doctor_name}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`kmc-badge ${u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                      {u.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(u)}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => toggleActive(u)}
                        className="text-xs font-semibold text-navy-700 hover:text-crimson-600 px-2"
                      >
                        {u.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"
                      >
                        <Trash2 size={14} />
                      </button>
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
