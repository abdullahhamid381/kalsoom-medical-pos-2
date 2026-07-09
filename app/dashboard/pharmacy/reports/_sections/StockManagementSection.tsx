'use client';
import { useEffect, useMemo, useState } from 'react';
import { Download, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b','#8b5cf6'];
const TYPE_LABELS: Record<string,string> = {
  purchase:'Purchase', adjustment:'Adjustment', sale:'Sale', transfer_in:'Transfer In',
  transfer_out:'Transfer Out', opening:'Opening', sale_return:'Sale Return', purchase_return:'Purchase Return',
};

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['Date','Medicine','Type','Location','Qty Change','Reference','By'];
  const csvRows = rows.map((m:any) => [new Date(m.created_at).toLocaleString('en-PK'), m.medicine_name, TYPE_LABELS[m.movement_type]||m.movement_type, m.location, m.qty_change, m.reference_no||'', m.updated_by_name]);
  const csv = [headers,...csvRows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Stock-Management-Report-${from}-to-${to}.csv`; a.click();
}

export default function StockManagementSection({ from, to }: { from: string; to: string }) {
  const [movements, setMovements] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [medicineId, setMedicineId] = useState('');
  const [location, setLocation] = useState('');
  const [movementType, setMovementType] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/api/pharmacy/medicines?all=1').then(d => setMedicines(d.medicines || [])).catch(() => {}); }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const sp = new URLSearchParams({ from, to });
    if (medicineId) sp.set('medicine_id', medicineId);
    if (location) sp.set('location', location);
    if (movementType) sp.set('movement_type', movementType);
    api.get(`/api/pharmacy/stock?${sp}`)
      .then(d => { if (active) setMovements(d.movements || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, medicineId, location, movementType]);

  const users = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of movements) map.set(m.created_by_user_id, m.updated_by_name);
    return [...map.entries()];
  }, [movements]);

  const filtered = userFilter ? movements.filter(m => String(m.created_by_user_id) === userFilter) : movements;

  const added = filtered.reduce((s, m) => s + (m.qty_change > 0 ? m.qty_change : 0), 0);
  const removed = filtered.reduce((s, m) => s + (m.qty_change < 0 ? Math.abs(m.qty_change) : 0), 0);

  const byTypeMap = new Map<string, number>();
  for (const m of filtered) byTypeMap.set(m.movement_type, (byTypeMap.get(m.movement_type) || 0) + 1);
  const byTypeData = [...byTypeMap.entries()].map(([type, count]) => ({ name: TYPE_LABELS[type] || type, count }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          <select className="kmc-input w-auto" value={medicineId} onChange={e => setMedicineId(e.target.value)}>
            <option value="">All Medicines</option>
            {medicines.map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="kmc-input w-auto" value={location} onChange={e => setLocation(e.target.value)}>
            <option value="">All Locations</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="store">Store</option>
          </select>
          <select className="kmc-input w-auto" value={movementType} onChange={e => setMovementType(e.target.value)}>
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="kmc-input w-auto" value={userFilter} onChange={e => setUserFilter(e.target.value)}>
            <option value="">All Staff</option>
            {users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <button onClick={() => exportCSV(filtered, from, to)} disabled={loading||!filtered.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Movements', value: filtered.length, icon: Package, tint:'bg-navy-50 text-navy-700' },
          { label:'Total Added', value: added, icon: TrendingUp, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Total Removed', value: removed, icon: TrendingDown, tint:'bg-crimson-50 text-crimson-700' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">By Movement Type</h2>
        {byTypeData.length === 0 ? <p className="text-sm text-gray-400">No movements in this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byTypeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis type="number" tick={{fontSize:11}} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={110}/>
              <Tooltip/>
              <Bar dataKey="count" name="Movements" radius={[0,4,4,0]}>
                {byTypeData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">Movement Log ({filtered.length})</h2>
          <button onClick={() => exportCSV(filtered, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
            {['Date','Medicine','Type','Location','Qty Change','Reference','By'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No movements in this range.</td></tr>}
            {filtered.map((m: any) => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(m.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-2.5 font-medium text-navy-900">{m.medicine_name}</td>
                <td className="px-4 py-2.5"><span className="kmc-badge bg-navy-50 text-navy-700">{TYPE_LABELS[m.movement_type]||m.movement_type}</span></td>
                <td className="px-4 py-2.5 text-gray-600 capitalize">{m.location}</td>
                <td className={`px-4 py-2.5 font-mono-num font-semibold ${m.qty_change > 0 ? 'text-emerald-700' : 'text-crimson-700'}`}>{m.qty_change > 0 ? '+' : ''}{m.qty_change}</td>
                <td className="px-4 py-2.5 text-gray-400">{m.reference_no || '—'}</td>
                <td className="px-4 py-2.5 text-gray-500">{m.updated_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
