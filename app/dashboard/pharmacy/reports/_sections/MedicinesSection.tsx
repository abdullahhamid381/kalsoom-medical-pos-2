'use client';
import { useEffect, useState } from 'react';
import { Download, Pill, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b','#8b5cf6'];

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['Name','Category','Unit','Purchase Price','Sale Price','Stock','Status'];
  const csvRows = rows.map((m:any) => [m.name, m.category||'', m.unit, m.purchase_price, m.sale_price, m.stock_qty + m.stock_qty_store, m.active ? 'active' : 'inactive']);
  const csv = [headers,...csvRows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Medicine-Report-${from}-to-${to}.csv`; a.click();
}

export default function MedicinesSection({ from, to }: { from: string; to: string }) {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/pharmacy/medicines?all=1&from=${from}&to=${to}`)
      .then(d => { if (active) setMedicines(d.medicines || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const active = medicines.filter(m => m.active);
  const inactive = medicines.filter(m => !m.active);
  const lowStock = active.filter(m => m.stock_qty <= m.low_stock_at);
  const inventoryValue = active.reduce((s, m) => s + (m.stock_qty + m.stock_qty_store) * m.sale_price, 0);

  const byCategoryMap = new Map<string, number>();
  for (const m of medicines) {
    const cat = m.category || 'Uncategorized';
    byCategoryMap.set(cat, (byCategoryMap.get(cat) || 0) + 1);
  }
  const byCategoryData = [...byCategoryMap.entries()].sort((a,b) => b[1]-a[1]).slice(0,8).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => exportCSV(medicines, from, to)} disabled={loading||!medicines.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label:'Total Medicines', value: medicines.length, icon: Pill, tint:'bg-navy-50 text-navy-700' },
          { label:'Active', value: active.length, icon: CheckCircle2, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Inactive', value: inactive.length, icon: XCircle, tint:'bg-gray-50 text-gray-500' },
          { label:'Low Stock', value: lowStock.length, icon: AlertTriangle, tint: lowStock.length>0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500' },
          { label:'Inventory Value', value:`Rs. ${inventoryValue.toLocaleString()}`, icon: Pill, tint:'bg-sky-50 text-sky-700' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={16}/></div>
            <p className="text-xl font-display font-bold text-navy-900 mt-2">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">By Category</h2>
        {byCategoryData.length === 0 ? <p className="text-sm text-gray-400">No medicines added in this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byCategoryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis type="number" tick={{fontSize:11}} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={110}/>
              <Tooltip/>
              <Bar dataKey="count" name="Medicines" radius={[0,4,4,0]}>
                {byCategoryData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">All Medicines ({medicines.length})</h2>
          <button onClick={() => exportCSV(medicines, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
            {['Name','Category','Unit','Purchase','Sale Price','Stock','Status'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && medicines.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No medicines found.</td></tr>}
            {medicines.map((m: any) => (
              <tr key={m.id} className={`border-b border-gray-50 last:border-0 ${!m.active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-navy-900">{m.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{m.category || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{m.unit}</td>
                <td className="px-4 py-3 font-mono-num text-gray-600">Rs. {m.purchase_price}</td>
                <td className="px-4 py-3 font-mono-num font-semibold text-navy-900">Rs. {m.sale_price}</td>
                <td className={`px-4 py-3 font-mono-num font-semibold ${m.stock_qty <= m.low_stock_at ? 'text-amber-600' : 'text-emerald-700'}`}>{m.stock_qty + m.stock_qty_store}</td>
                <td className="px-4 py-3"><span className={`kmc-badge ${m.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>{m.active ? 'active' : 'inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
