'use client';
import { useEffect, useState } from 'react';
import { Download, Truck, Banknote, Wallet, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b'];

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['Supplier','Phone','Received (Range)','Paid (Range)','Returned (Range)','Balance (All-Time)'];
  const csvRows = rows.map((s:any) => [s.name, s.phone||'', s.receivedInRange, s.paidInRange, s.returnedInRange, s.balance]);
  const csv = [headers,...csvRows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Supplier-Report-${from}-to-${to}.csv`; a.click();
}

export default function SuppliersSection({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/pharmacy/reports/suppliers?from=${from}&to=${to}`)
      .then(d => { if (active) setData(d); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const suppliers: any[] = data?.suppliers || [];
  const topSuppliers = [...suppliers].sort((a, b) => b.receivedInRange - a.receivedInRange).slice(0, 5)
    .map(s => ({ name: s.name.slice(0, 15), received: s.receivedInRange }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => exportCSV(suppliers, from, to)} disabled={loading||!suppliers.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label:'Active Suppliers', value: suppliers.length, icon: Truck, tint:'bg-navy-50 text-navy-700' },
          { label:'Received (Range)', value:`Rs. ${Number(data?.totals?.receivedValue??0).toLocaleString()}`, icon: Banknote, tint:'bg-sky-50 text-sky-700' },
          { label:'Paid (Range)', value:`Rs. ${Number(data?.totals?.totalPaid??0).toLocaleString()}`, icon: Wallet, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Outstanding (All-Time)', value:`Rs. ${Number(data?.totals?.totalOutstanding??0).toLocaleString()}`, icon: TrendingDown, tint:'bg-crimson-50 text-crimson-700' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={16}/></div>
            <p className="text-xl font-display font-bold text-navy-900 mt-2">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">Top Suppliers by Received Value</h2>
        {topSuppliers.length === 0 ? <p className="text-sm text-gray-400">No purchases in this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topSuppliers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis type="number" tick={{fontSize:11}}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={100}/>
              <Tooltip formatter={(v:any) => `Rs. ${Number(v).toLocaleString()}`}/>
              <Bar dataKey="received" name="Received" radius={[0,4,4,0]}>
                {topSuppliers.map((_:any, i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">All Suppliers ({suppliers.length})</h2>
          <button onClick={() => exportCSV(suppliers, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
            {['Supplier','Phone','Received','Paid','Returned','Balance'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && suppliers.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No suppliers found.</td></tr>}
            {suppliers.map((s: any) => (
              <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                onClick={() => window.open(`/dashboard/pharmacy/suppliers/${s.id}`, '_blank')}>
                <td className="px-4 py-3 font-medium text-navy-900">{s.name}</td>
                <td className="px-4 py-3 font-mono-num text-gray-500 text-xs">{s.phone || '—'}</td>
                <td className="px-4 py-3 font-mono-num text-gray-600">Rs. {s.receivedInRange}</td>
                <td className="px-4 py-3 font-mono-num text-emerald-700">Rs. {s.paidInRange}</td>
                <td className="px-4 py-3 font-mono-num text-gray-500">Rs. {s.returnedInRange}</td>
                <td className={`px-4 py-3 font-mono-num font-semibold ${s.balance > 0 ? 'text-crimson-700' : 'text-emerald-700'}`}>Rs. {s.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
