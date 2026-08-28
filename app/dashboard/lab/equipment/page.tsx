'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Wrench, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api-client';

const empty = { name: '', model: '', serial_no: '', location: '' };
const maintEmpty = { maintenance_date: new Date().toISOString().slice(0, 10), next_due_date: '', performed_by: '', notes: '' };

export default function LabEquipmentPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [dueSoon, setDueSoon] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [maintFor, setMaintFor] = useState<number | null>(null);
  const [maintForm, setMaintForm] = useState(maintEmpty);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get('/api/lab/equipment');
      setEquipment(d.equipment || []); setDueSoon(d.dueSoon || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try { await api.post('/api/lab/equipment', form); setShowForm(false); setForm(empty); load(); }
    catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleMaintSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!maintFor) return;
    try { await api.post(`/api/lab/equipment/${maintFor}/maintenance`, maintForm); setMaintFor(null); setMaintForm(maintEmpty); load(); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2"><Wrench size={22} className="text-sky-600"/> Equipment</h1>
          <p className="text-sm text-gray-500 mt-1">Analyzers and instruments, with maintenance history.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/> Add Equipment</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {dueSoon.length > 0 && (
        <div className="kmc-card p-4 border-amber-200 bg-amber-50 text-amber-800 flex items-start gap-2 text-sm">
          <AlertTriangle size={16} className="mt-0.5"/>
          <div>
            <p className="font-semibold">Maintenance due soon</p>
            <ul className="mt-1 space-y-0.5">
              {dueSoon.map((d: any) => <li key={d.equipment_id}>{d.name} — due {d.next_due_date}</li>)}
            </ul>
          </div>
        </div>
      )}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Add Equipment</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="kmc-label">Name *</label><input className="kmc-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required/></div>
            <div><label className="kmc-label">Model</label><input className="kmc-input" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}/></div>
            <div><label className="kmc-label">Serial No.</label><input className="kmc-input" value={form.serial_no} onChange={e => setForm({ ...form, serial_no: e.target.value })}/></div>
            <div><label className="kmc-label">Location</label><input className="kmc-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}/></div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : 'Add Equipment'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="kmc-card p-8 text-center text-gray-400">Loading...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {equipment.map((e: any) => (
            <div key={e.id} className="kmc-card p-5">
              <p className="font-semibold text-navy-900">{e.name}</p>
              <p className="text-xs text-gray-400">{e.model} {e.serial_no ? `· ${e.serial_no}` : ''} {e.location ? `· ${e.location}` : ''}</p>
              <div className="mt-3 space-y-1">
                {(e.maintenance || []).slice(0, 3).map((m: any) => (
                  <p key={m.id} className="text-xs text-gray-500">{m.maintenance_date} — {m.performed_by || 'staff'}{m.next_due_date ? ` (next due ${m.next_due_date})` : ''}</p>
                ))}
                {(e.maintenance || []).length === 0 && <p className="text-xs text-gray-400">No maintenance logged yet.</p>}
              </div>
              <button onClick={() => setMaintFor(maintFor === e.id ? null : e.id)} className="kmc-btn-ghost text-xs px-3 py-1.5 mt-3">Log Maintenance</button>
              {maintFor === e.id && (
                <form onSubmit={handleMaintSubmit} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><label className="kmc-label">Date</label><input type="date" className="kmc-input text-xs" value={maintForm.maintenance_date} onChange={ev => setMaintForm({ ...maintForm, maintenance_date: ev.target.value })}/></div>
                    <div><label className="kmc-label">Next Due</label><input type="date" className="kmc-input text-xs" value={maintForm.next_due_date} onChange={ev => setMaintForm({ ...maintForm, next_due_date: ev.target.value })}/></div>
                  </div>
                  <input className="kmc-input text-xs" placeholder="Performed by" value={maintForm.performed_by} onChange={ev => setMaintForm({ ...maintForm, performed_by: ev.target.value })}/>
                  <input className="kmc-input text-xs" placeholder="Notes" value={maintForm.notes} onChange={ev => setMaintForm({ ...maintForm, notes: ev.target.value })}/>
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
