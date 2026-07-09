'use client';
import { useEffect, useState } from 'react';
import { Download, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['Phone','Customer Name','Balance'];
  const csvRows = rows.map((c:any) => [c.phone, c.customer_name||'', c.balance]);
  const csv = [headers,...csvRows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Customer-Credit-Report-${from}-to-${to}.csv`; a.click();
}

export default function CustomerCreditSection({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/pharmacy/customer-credit?from=${from}&to=${to}`)
      .then(d => { if (active) setData(d); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const customers: any[] = data?.customers || [];
  const byDayData = (data?.byDay || []).map((r: any) => ({ date: r.date.slice(5), issued: r.issued, redeemed: r.redeemed }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => exportCSV(customers, from, to)} disabled={loading||!customers.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Credit Issued (Range)', value:`Rs. ${Number(data?.totals?.issued??0).toLocaleString()}`, icon: TrendingUp, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Credit Redeemed (Range)', value:`Rs. ${Number(data?.totals?.redeemed??0).toLocaleString()}`, icon: TrendingDown, tint:'bg-sky-50 text-sky-700' },
          { label:'Outstanding (All-Time)', value:`Rs. ${Number(data?.totalOutstanding??0).toLocaleString()}`, icon: Wallet, tint:'bg-crimson-50 text-crimson-700' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">Issued vs Redeemed by Day</h2>
        {byDayData.length === 0 ? <p className="text-sm text-gray-400">No credit activity in this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="date" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}}/>
              <Tooltip formatter={(v:any) => `Rs. ${Number(v).toLocaleString()}`}/>
              <Legend/>
              <Bar dataKey="issued" name="Issued" fill="#10b981" radius={[4,4,0,0]}/>
              <Bar dataKey="redeemed" name="Redeemed" fill="#0ea5e9" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">Customers with Store Credit ({customers.length})</h2>
          <button onClick={() => exportCSV(customers, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
            {['Phone','Customer Name','Balance'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && customers.length === 0 && <tr><td colSpan={3} className="px-5 py-10 text-center text-gray-400">No customers with outstanding credit.</td></tr>}
            {customers.map((c: any) => (
              <tr key={c.phone} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 font-mono-num text-gray-600">{c.phone}</td>
                <td className="px-4 py-3 font-medium text-navy-900">{c.customer_name || '—'}</td>
                <td className={`px-4 py-3 font-mono-num font-semibold ${c.balance > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>Rs. {c.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
