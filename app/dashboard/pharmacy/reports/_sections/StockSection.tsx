'use client';
import { useEffect, useState } from 'react';
import { Download, Package, Store, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function exportCSV(data: any, from: string, to: string) {
  const headers = ['Medicine','Location','Current Pharmacy Stock','Current Store Stock','Total Added','Total Removed'];
  const rows = (data.currentStock || []).map((m: any) => [
    m.name, m.location, m.stock_qty, m.stock_qty_store, '—', '—'
  ]);
  const csv = [headers,...rows].map((r:any[])=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Stock-Report-${from}-to-${to}.csv`; a.click();
}

export default function StockSection({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/pharmacy/stock-report?from=${from}&to=${to}`)
      .then(d => { if (active) { setData(d); } })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const byDayData = (data?.byDay || []).map((r: any) => ({ date: r.date.slice(5), added: r.added, removed: r.removed }));
  const byMedData = (data?.byMedicine || []).map((r: any) => ({ name: r.medicine_name.slice(0,15), added: r.added, removed: r.removed }));

  const pharmacyStock = (data?.currentStock || []).filter((m: any) => m.active);
  const lowPharmacy = pharmacyStock.filter((m: any) => m.stock_qty <= m.low_stock_at);
  const lowStore = pharmacyStock.filter((m: any) => m.stock_qty_store <= m.low_stock_at);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => data && exportCSV(data, from, to)} disabled={!data} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export Stock Snapshot
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Movements', value: data?.totals?.total_movements??0, icon: Package, tint:'bg-navy-50 text-navy-700' },
          { label:'Total Added', value: data?.totals?.total_added??0, icon: TrendingUp, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Total Removed', value: data?.totals?.total_removed??0, icon: TrendingDown, tint:'bg-crimson-50 text-crimson-700' },
          { label:'Low Stock Items', value: Math.max(lowPharmacy.length, lowStore.length), icon: Package, tint: lowPharmacy.length>0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={16}/></div>
            <p className="text-xl font-display font-bold text-navy-900 mt-2">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">Daily Stock Movement</h2>
        {byDayData.length === 0 ? <p className="text-sm text-gray-400">No movements in this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="date" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}} allowDecimals={false}/>
              <Tooltip/>
              <Legend/>
              <Bar dataKey="added" name="Added" fill="#10b981" radius={[4,4,0,0]}/>
              <Bar dataKey="removed" name="Removed" fill="#d62828" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Top Active Medicines</h2>
          {byMedData.length === 0 ? <p className="text-sm text-gray-400">No data.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byMedData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis type="number" tick={{fontSize:10}} allowDecimals={false}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={100}/>
                <Tooltip/>
                <Bar dataKey="added" name="Added" fill="#10b981" radius={[0,4,4,0]}/>
                <Bar dataKey="removed" name="Removed" fill="#d62828" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="kmc-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-display font-semibold text-navy-900">By Staff Member</h2>
          </div>
          <div className="p-5 space-y-2">
            {(data?.byUser||[]).length === 0 && <p className="text-sm text-gray-400">No movements in this range.</p>}
            {(data?.byUser||[]).map((u: any) => (
              <div key={u.user_name} className="flex items-center justify-between text-sm">
                <span className="font-medium text-navy-900">{u.user_name}</span>
                <span className="text-xs text-gray-500">
                  {u.count} updates — <span className="text-emerald-600">+{u.added}</span> / <span className="text-crimson-600">-{u.removed}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="kmc-card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">Current Stock Snapshot</h2>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Package size={12} className="text-sky-500"/> Pharmacy Counter</span>
            <span className="flex items-center gap-1"><Store size={12} className="text-purple-500"/> Store Room</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                {['Medicine','Unit','Pharmacy Stock','Store Stock','Total','Low Stock Alert','Status'].map(h=>
                  <th key={h} className="px-5 py-3 font-semibold whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
              {pharmacyStock.map((m: any) => {
                const total = m.stock_qty + m.stock_qty_store;
                const isLow = m.stock_qty <= m.low_stock_at || m.stock_qty_store <= m.low_stock_at;
                return (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-2.5 font-medium text-navy-900">{m.name}</td>
                    <td className="px-5 py-2.5 text-gray-500">{m.unit}</td>
                    <td className={`px-5 py-2.5 font-mono-num font-semibold ${m.stock_qty <= m.low_stock_at ? 'text-amber-600' : 'text-sky-700'}`}>
                      {m.stock_qty}
                    </td>
                    <td className={`px-5 py-2.5 font-mono-num font-semibold ${m.stock_qty_store <= m.low_stock_at ? 'text-amber-600' : 'text-purple-700'}`}>
                      {m.stock_qty_store}
                    </td>
                    <td className="px-5 py-2.5 font-mono-num font-bold text-navy-900">{total}</td>
                    <td className="px-5 py-2.5 text-gray-400 font-mono-num text-xs">{m.low_stock_at}</td>
                    <td className="px-5 py-2.5">
                      <span className={`kmc-badge ${isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {isLow ? '⚠ Low Stock' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
