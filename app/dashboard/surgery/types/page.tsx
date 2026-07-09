'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';

const empty = { name:'', category:'', base_price:'', description:'', duration_hrs:'1' };

export default function SurgeryTypesPage() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function load() { setLoading(true); try { const d = await api.get(`/api/surgery/types${showAll?'?all=1':''}`); setTypes(d.types||[]); } catch(e:any){setError(e.message);} finally{setLoading(false);} }
  useEffect(()=>{load();},[showAll]);

  function openCreate() { setForm(empty); setEditId(null); setShowForm(true); }
  function openEdit(t: any) { setForm({name:t.name,category:t.category||'',base_price:String(t.base_price),description:t.description||'',duration_hrs:String(t.duration_hrs||1)}); setEditId(t.id); setShowForm(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const p = {...form, base_price:Number(form.base_price), duration_hrs:Number(form.duration_hrs)};
      if (editId) await api.put(`/api/surgery/types/${editId}`,p); else await api.post('/api/surgery/types',p);
      setShowForm(false); load();
    } catch(e:any){setError(e.message);} finally{setSaving(false);}
  }

  const grouped: Record<string,any[]> = {};
  for (const t of types) { const k = t.category||'General'; if(!grouped[k]) grouped[k]=[]; grouped[k].push(t); }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold text-navy-900">Surgery Types</h1><p className="text-sm text-gray-500 mt-1">Define surgeries, base fees and estimated durations.</p></div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)} className="rounded"/>Show inactive</label>
          <button onClick={openCreate} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>Add Type</button>
        </div>
      </div>
      {error&&<div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}
      {showForm&&(
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4"><h2 className="font-display font-semibold text-navy-900">{editId?'Edit Surgery Type':'Add Surgery Type'}</h2><button onClick={()=>setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="kmc-label">Surgery Name *</label><input className="kmc-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
            <div><label className="kmc-label">Category</label><input className="kmc-input" placeholder="e.g. Orthopedic, General, Cardiac" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></div>
            <div><label className="kmc-label">Base Price (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={form.base_price} onChange={e=>setForm({...form,base_price:e.target.value})} required/></div>
            <div><label className="kmc-label">Duration (hrs)</label><input type="number" min="0.5" step="0.5" className="kmc-input font-mono-num" value={form.duration_hrs} onChange={e=>setForm({...form,duration_hrs:e.target.value})}/></div>
            <div className="sm:col-span-2"><label className="kmc-label">Description</label><input className="kmc-input" placeholder="Brief description, instruments needed..." value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={()=>setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving?'Saving...':editId?'Save Changes':'Add Type'}</button>
            </div>
          </form>
        </div>
      )}
      {loading?<div className="kmc-card p-8 text-center text-gray-400">Loading...</div>:(
        Object.entries(grouped).map(([cat,items])=>(
          <div key={cat} className="kmc-card">
            <div className="px-5 py-3 border-b border-gray-100 bg-mist/60 rounded-t-2xl"><h3 className="font-display font-semibold text-navy-900 text-sm">{cat}</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                  {['Surgery Name','Base Price','Duration','Description','Status','Actions'].map(h=><th key={h} className="px-5 py-2.5 font-semibold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {items.map((t:any)=>(
                    <tr key={t.id} className={`border-b border-gray-50 last:border-0 ${!t.active?'opacity-50':''}`}>
                      <td className="px-5 py-3 font-medium text-navy-900">{t.name}</td>
                      <td className="px-5 py-3 font-mono-num font-semibold text-navy-800">Rs.{t.base_price}</td>
                      <td className="px-5 py-3 text-gray-500">{t.duration_hrs}hrs</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{t.description||'—'}</td>
                      <td className="px-5 py-3"><span className={`kmc-badge ${t.active?'bg-emerald-100 text-emerald-800':'bg-gray-200 text-gray-600'}`}>{t.active?'active':'inactive'}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={()=>openEdit(t)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-mist"><Pencil size={13}/></button>
                          <button onClick={()=>api.put(`/api/surgery/types/${t.id}`,{active:!t.active}).then(()=>load())} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 px-1">{t.active?'Deactivate':'Activate'}</button>
                          <button onClick={()=>confirm(`Remove ${t.name}?`)&&api.delete(`/api/surgery/types/${t.id}`).then(()=>load()).catch((e:any)=>setError(e.message))} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"><Trash2 size={13}/></button>
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
