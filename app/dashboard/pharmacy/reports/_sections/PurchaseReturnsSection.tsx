'use client';
import { useEffect, useState } from 'react';
import { Download, Undo2, Banknote } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b'];

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['Return No','Date','Supplier','Reason','Total','By'];
  const csvRows = rows.map((r:any) => [r.return_no, new Date(r.created_at).toLocaleString('en-PK'), r.supplier_name, r.reason||'', r.total, r.created_by_name]);
  const csv = [headers,...csvRows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Purchase-Return-Report-${from}-to-${to}.csv`; a.click();
}

export default function PurchaseReturnsSection({ from, to }: { from: string; to: string }) {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/pharmacy/purchase-returns?from=${from}&to=${to}`)
      .then(d => { if (active) setReturns(d.purchaseReturns || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const totalValue = returns.reduce((s, r) => s + r.total, 0);

  const byDayMap = new Map<string, number>();
  for (const r of returns) {
    const d = r.created_at.slice(0, 10);
    byDayMap.set(d, (byDayMap.get(d) || 0) + r.total);
  }
  const byDayData = [...byDayMap.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([date, total]) => ({ date: date.slice(5), total }));

  const bySupplierMap = new Map<string, number>();
  for (const r of returns) bySupplierMap.set(r.supplier_name, (bySupplierMap.get(r.supplier_name) || 0) + r.total);
  const bySupplierData = [...bySupplierMap.entries()].sort((a,b) => b[1]-a[1]).slice(0,5).map(([name, total]) => ({ name: name.slice(0,15), total }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => exportCSV(returns, from, to)} disabled={loading||!returns.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label:'Total Returns', value: returns.length, icon: Undo2, tint:'bg-navy-50 text-navy-700' },
          { label:'Total Value', value:`Rs. ${totalValue.toLocaleString()}`, icon: Banknote, tint:'bg-crimson-50 text-crimson-700' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Returns by Day</h2>
          {byDayData.length === 0 ? <p className="text-sm text-gray-400">No returns in this range.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byDayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="date" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(v:any) => `Rs. ${Number(v).toLocaleString()}`}/>
                <Bar dataKey="total" fill="#d62828" name="Value" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Top Suppliers Returned To</h2>
          {bySupplierData.length === 0 ? <p className="text-sm text-gray-400">No data.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bySupplierData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis type="number" tick={{fontSize:11}}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={100}/>
                <Tooltip formatter={(v:any) => `Rs. ${Number(v).toLocaleString()}`}/>
                <Bar dataKey="total" name="Value" radius={[0,4,4,0]}>
                  {bySupplierData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">All Purchase Returns ({returns.length})</h2>
          <button onClick={() => exportCSV(returns, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
            {['Return No','Date','Supplier','Reason','Total','By'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && returns.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No purchase returns in this range.</td></tr>}
            {returns.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-mono-num text-navy-800">{r.return_no}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-3 font-medium text-navy-900">{r.supplier_name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.reason || '—'}</td>
                <td className="px-4 py-3 font-mono-num font-semibold">Rs. {r.total}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.created_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
