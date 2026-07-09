'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Pencil, Trash2, Search, Package, Store, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { api } from '@/lib/api-client';

type Movement = {
  id: number; medicine_name: string; movement_type: string; location: string;
  qty_change: number; qty_before: number; qty_after: number;
  reference_no: string | null; notes: string | null;
  updated_by_name: string; created_at: string;
};
type Medicine = { id: number; name: string; unit: string; stock_qty: number; stock_qty_store: number; };

const TYPES = ['purchase','adjustment','transfer_in','transfer_out','opening'];
const TYPE_LABELS: Record<string,string> = {
  purchase:'Purchase (Received)', adjustment:'Adjustment', sale:'Sale (Auto)',
  transfer_in:'Transfer In', transfer_out:'Transfer Out', opening:'Opening Stock'
};
const TYPE_COLORS: Record<string,string> = {
  purchase:'bg-emerald-100 text-emerald-800', adjustment:'bg-amber-100 text-amber-800',
  sale:'bg-navy-100 text-navy-800', transfer_in:'bg-sky-100 text-sky-800',
  transfer_out:'bg-orange-100 text-orange-800', opening:'bg-purple-100 text-purple-800'
};

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function todayStr() { return new Date().toISOString().slice(0,10); }

export default function StockPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editRef, setEditRef] = useState('');
  const [saving, setSaving] = useState(false);

  // Filters
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(todayStr());
  const [filterMed, setFilterMed] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [filterType, setFilterType] = useState('');

  // Add stock form
  const [form, setForm] = useState({
    medicine_id: '', movement_type: 'purchase', location: 'pharmacy',
    qty_change: '', reference_no: '', notes: ''
  });

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (filterMed)  params.set('medicine_id', filterMed);
    if (filterLoc)  params.set('location', filterLoc);
    if (filterType) params.set('movement_type', filterType);
    try {
      const [mv, meds] = await Promise.all([
        api.get(`/api/pharmacy/stock?${params}`),
        api.get('/api/pharmacy/medicines?all=1')
      ]);
      setMovements(mv.movements || []);
      setMedicines(meds.medicines || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [from, to, filterMed, filterLoc, filterType]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.post('/api/pharmacy/stock', {
        ...form,
        medicine_id: Number(form.medicine_id),
        qty_change: Number(form.qty_change)
      });
      setShowForm(false);
      setForm({ medicine_id:'', movement_type:'purchase', location:'pharmacy', qty_change:'', reference_no:'', notes:'' });
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleEditSave(id: number) {
    setSaving(true);
    try {
      await api.put(`/api/pharmacy/stock/${id}`, { notes: editNotes, reference_no: editRef });
      setEditId(null); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(mv: Movement) {
    if (!confirm(`Delete this movement (${mv.movement_type} of ${Math.abs(mv.qty_change)} ${mv.location})? Stock will be reversed.`)) return;
    try { await api.delete(`/api/pharmacy/stock/${mv.id}`); load(); }
    catch (e: any) { setError(e.message); }
  }

  function exportCSV() {
    const headers = ['Date','Medicine','Type','Location','Change','Before','After','Reference','Notes','Updated By'];
    const rows = movements.map(m => [
      new Date(m.created_at).toLocaleString('en-PK'), m.medicine_name,
      TYPE_LABELS[m.movement_type]||m.movement_type, m.location,
      m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change,
      m.qty_before, m.qty_after, m.reference_no||'', m.notes||'', m.updated_by_name
    ]);
    const csv = [headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `Stock-Movements-${from}-to-${to}.csv`; a.click();
  }

  const selectedMed = medicines.find(m => m.id === Number(form.medicine_id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Stock Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete audit trail of every stock change — who updated what, when, and where (Pharmacy or Store).
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={movements.length===0} className="kmc-btn-ghost text-sm">Export CSV</button>
          <button onClick={() => setShowForm(true)} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>Add Stock</button>
        </div>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {/* Add stock form */}
      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Add / Update Stock</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="kmc-label">Medicine *</label>
              <select className="kmc-input" value={form.medicine_id} onChange={e => setForm({...form, medicine_id: e.target.value})} required>
                <option value="">Select medicine...</option>
                {medicines.filter(m => m.stock_qty !== undefined).map(m => (
                  <option key={m.id} value={m.id}>{m.name} (Pharmacy: {m.stock_qty} | Store: {m.stock_qty_store} {m.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="kmc-label">Movement Type *</label>
              <select className="kmc-input" value={form.movement_type} onChange={e => setForm({...form, movement_type: e.target.value})}>
                {TYPES.filter(t => t !== 'opening').map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="kmc-label">Location *</label>
              <select className="kmc-input" value={form.location} onChange={e => setForm({...form, location: e.target.value})}>
                <option value="pharmacy">Pharmacy Counter</option>
                <option value="store">Store Room</option>
              </select>
            </div>
            <div>
              <label className="kmc-label">
                Quantity Change * {form.movement_type === 'transfer_out' || form.movement_type === 'adjustment' ? '(use negative to reduce)' : '(positive to add)'}
              </label>
              <input type="number" className="kmc-input font-mono-num" value={form.qty_change}
                onChange={e => setForm({...form, qty_change: e.target.value})}
                placeholder={form.movement_type === 'transfer_out' ? 'e.g. -50' : 'e.g. 100'} required/>
              {selectedMed && (
                <p className="text-xs text-gray-400 mt-1">
                  Current {form.location} stock: <span className="font-semibold text-navy-700">
                    {form.location === 'store' ? selectedMed.stock_qty_store : selectedMed.stock_qty} {selectedMed.unit}
                  </span>
                </p>
              )}
            </div>
            <div>
              <label className="kmc-label">Reference No. (PO / Invoice)</label>
              <input className="kmc-input font-mono-num" placeholder="e.g. PO-2026-001" value={form.reference_no} onChange={e => setForm({...form, reference_no: e.target.value})}/>
            </div>
            <div>
              <label className="kmc-label">Notes</label>
              <input className="kmc-input" placeholder="Supplier name, batch no., reason..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}/>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving ? 'Saving...' : 'Save Movement'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="kmc-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input type="date" className="kmc-input" value={from} onChange={e=>setFrom(e.target.value)}/>
        <input type="date" className="kmc-input" value={to} onChange={e=>setTo(e.target.value)}/>
        <select className="kmc-input" value={filterMed} onChange={e=>setFilterMed(e.target.value)}>
          <option value="">All Medicines</option>
          {medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="kmc-input" value={filterLoc} onChange={e=>setFilterLoc(e.target.value)}>
          <option value="">Both Locations</option>
          <option value="pharmacy">Pharmacy Counter</option>
          <option value="store">Store Room</option>
        </select>
        <select className="kmc-input" value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Current stock snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="kmc-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} className="text-sky-600"/><h3 className="font-display font-semibold text-navy-900 text-sm">Pharmacy Counter Stock</h3>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {medicines.filter(m=>m.stock_qty !== undefined).map(m => (
              <div key={m.id} className={`flex justify-between text-xs ${m.stock_qty <= 10 ? 'text-amber-600 font-semibold' : 'text-gray-600'}`}>
                <span>{m.name}</span><span className="font-mono-num">{m.stock_qty} {m.unit}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="kmc-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Store size={16} className="text-purple-600"/><h3 className="font-display font-semibold text-navy-900 text-sm">Store Room Stock</h3>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {medicines.filter(m=>m.stock_qty_store !== undefined).map(m => (
              <div key={m.id} className={`flex justify-between text-xs ${m.stock_qty_store <= 10 ? 'text-amber-600 font-semibold' : 'text-gray-600'}`}>
                <span>{m.name}</span><span className="font-mono-num">{m.stock_qty_store} {m.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Movements table */}
      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">Movement History ({movements.length})</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
              {['Date & Time','Medicine','Type','Location','Change','Before→After','Reference','Notes','Updated By','Actions'].map(h=>
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && movements.length === 0 && <tr><td colSpan={10} className="px-5 py-8 text-center text-gray-400">No movements in this range.</td></tr>}
            {movements.map(mv => (
              <tr key={mv.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/40">
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(mv.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-2.5 font-medium text-navy-900">{mv.medicine_name}</td>
                <td className="px-4 py-2.5"><span className={`kmc-badge ${TYPE_COLORS[mv.movement_type]||'bg-gray-100 text-gray-700'}`}>{TYPE_LABELS[mv.movement_type]||mv.movement_type}</span></td>
                <td className="px-4 py-2.5">
                  <span className={`kmc-badge ${mv.location==='pharmacy' ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'}`}>
                    {mv.location === 'pharmacy' ? '💊 Pharmacy' : '🏪 Store'}
                  </span>
                </td>
                <td className={`px-4 py-2.5 font-mono-num font-bold ${mv.qty_change > 0 ? 'text-emerald-600' : 'text-crimson-600'}`}>
                  <span className="flex items-center gap-1">
                    {mv.qty_change > 0 ? <ArrowUpCircle size={12}/> : <ArrowDownCircle size={12}/>}
                    {mv.qty_change > 0 ? `+${mv.qty_change}` : mv.qty_change}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono-num text-gray-500">{mv.qty_before} → {mv.qty_after}</td>
                <td className="px-4 py-2.5 text-gray-500 font-mono-num">{mv.reference_no || '—'}</td>
                <td className="px-4 py-2.5 text-gray-500 max-w-[150px] truncate">{mv.notes || '—'}</td>
                <td className="px-4 py-2.5 text-gray-500 font-semibold whitespace-nowrap">{mv.updated_by_name}</td>
                <td className="px-4 py-2.5">
                  {editId === mv.id ? (
                    <div className="flex gap-1 items-center">
                      <input className="kmc-input text-xs w-24" placeholder="Notes" value={editNotes} onChange={e=>setEditNotes(e.target.value)}/>
                      <input className="kmc-input text-xs w-20" placeholder="Ref" value={editRef} onChange={e=>setEditRef(e.target.value)}/>
                      <button onClick={() => handleEditSave(mv.id)} disabled={saving} className="text-emerald-600 font-bold text-xs px-1">Save</button>
                      <button onClick={() => setEditId(null)} className="text-gray-400 text-xs px-1">✕</button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {mv.movement_type !== 'sale' && (
                        <button onClick={() => { setEditId(mv.id); setEditNotes(mv.notes||''); setEditRef(mv.reference_no||''); }}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-mist">
                          <Pencil size={11}/>
                        </button>
                      )}
                      {mv.movement_type !== 'sale' && (
                        <button onClick={() => handleDelete(mv)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-crimson-50 hover:text-crimson-600">
                          <Trash2 size={11}/>
                        </button>
                      )}
                      {mv.movement_type === 'sale' && <span className="text-gray-300 text-xs italic">auto</span>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
