'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, BedDouble } from 'lucide-react';
import { api } from '@/lib/api-client';

const TYPES = ['general','ac','non_ac','private','icu','semi_private'];
const TYPE_LABELS: Record<string,string> = { general:'General Ward', ac:'AC Room', non_ac:'Non-AC Room', private:'Private Room', icu:'ICU', semi_private:'Semi-Private' };
const TYPE_COLORS: Record<string,string> = {
  general:'bg-gray-100 text-gray-700', ac:'bg-sky-100 text-sky-700', non_ac:'bg-amber-100 text-amber-700',
  private:'bg-purple-100 text-purple-700', icu:'bg-crimson-100 text-crimson-800', semi_private:'bg-indigo-100 text-indigo-700'
};
const STATUS_COLORS: Record<string,string> = {
  available:'bg-emerald-100 text-emerald-800', occupied:'bg-crimson-100 text-crimson-800', maintenance:'bg-gray-200 text-gray-600'
};
const empty = { room_no:'', room_type:'general', floor:'', price_per_day:'', description:'' };

export default function RoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    try { const d = await api.get(`/api/ipd/rooms${showAll ? '?all=1' : ''}`); setRooms(d.rooms || []); }
    catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [showAll]);

  function openCreate() { setForm(empty); setEditId(null); setShowForm(true); }
  function openEdit(r: any) {
    setForm({ room_no:r.room_no, room_type:r.room_type, floor:r.floor||'', price_per_day:String(r.price_per_day), description:r.description||'' });
    setEditId(r.id); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, price_per_day: Number(form.price_per_day) };
      if (editId) await api.put(`/api/ipd/rooms/${editId}`, payload);
      else await api.post('/api/ipd/rooms', payload);
      setShowForm(false); load();
    } catch (e:any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(r: any, status: string) {
    try { await api.put(`/api/ipd/rooms/${r.id}`, { status }); load(); }
    catch (e:any) { setError(e.message); }
  }

  async function handleDelete(r: any) {
    if (!confirm(`Remove room ${r.room_no}?`)) return;
    try { await api.delete(`/api/ipd/rooms/${r.id}`); load(); }
    catch (e:any) { setError(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold text-navy-900">Room Management</h1><p className="text-sm text-gray-500 mt-1">Manage hospital rooms, types, and pricing.</p></div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)} className="rounded"/>Show inactive</label>
          <button onClick={openCreate} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>Add Room</button>
        </div>
      </div>
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">{editId ? 'Edit Room' : 'Add Room'}</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="kmc-label">Room Number *</label><input className="kmc-input font-mono-num" placeholder="e.g. 101, ICU-3" value={form.room_no} onChange={e=>setForm({...form,room_no:e.target.value})} required/></div>
            <div><label className="kmc-label">Room Type</label>
              <select className="kmc-input" value={form.room_type} onChange={e=>setForm({...form,room_type:e.target.value})}>
                {TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><label className="kmc-label">Floor</label><input className="kmc-input" placeholder="e.g. Ground, 1st, 2nd" value={form.floor} onChange={e=>setForm({...form,floor:e.target.value})}/></div>
            <div><label className="kmc-label">Price Per Day (Rs.) *</label><input type="number" min="0" className="kmc-input font-mono-num" value={form.price_per_day} onChange={e=>setForm({...form,price_per_day:e.target.value})} required/></div>
            <div className="sm:col-span-2"><label className="kmc-label">Description</label><input className="kmc-input" placeholder="Facilities, notes..." value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving?'Saving...':editId?'Save Changes':'Add Room'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <p className="text-gray-400 text-sm">Loading...</p>}
        {!loading && rooms.length === 0 && <p className="text-gray-400 text-sm">No rooms configured yet.</p>}
        {rooms.map(r => (
          <div key={r.id} className={`kmc-card p-5 ${!r.active?'opacity-50':''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
                  <BedDouble size={20}/>
                </div>
                <div>
                  <p className="font-display font-bold text-navy-900 text-lg">{r.room_no}</p>
                  <span className={`kmc-badge text-[11px] ${TYPE_COLORS[r.room_type]||''}`}>{TYPE_LABELS[r.room_type]||r.room_type}</span>
                </div>
              </div>
              <span className={`kmc-badge ${STATUS_COLORS[r.status]||''}`}>{r.status}</span>
            </div>
            <div className="mt-3 text-xs text-gray-500 space-y-1">
              <p>Floor: {r.floor || '—'}</p>
              <p className="font-mono-num font-semibold text-navy-800 text-sm">Rs. {r.price_per_day} / day</p>
              {r.description && <p className="text-gray-400">{r.description}</p>}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-1.5">
                <button onClick={()=>openEdit(r)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"><Pencil size={12}/></button>
                <button onClick={()=>handleDelete(r)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"><Trash2 size={12}/></button>
              </div>
              {r.status === 'available' && (
                <button onClick={()=>handleStatusChange(r,'maintenance')} className="text-xs text-gray-400 hover:text-amber-600">Set Maintenance</button>
              )}
              {r.status === 'maintenance' && (
                <button onClick={()=>handleStatusChange(r,'available')} className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold">Mark Available</button>
              )}
              {r.status === 'occupied' && (
                <span className="text-xs text-crimson-500 font-semibold">Currently occupied</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
