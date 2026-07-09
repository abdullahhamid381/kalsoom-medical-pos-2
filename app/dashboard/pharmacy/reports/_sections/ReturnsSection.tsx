'use client';
import { useEffect, useState } from 'react';
import { Download, RotateCcw, Wallet, Banknote } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b'];
const OUTCOME_LABELS: Record<string,string> = { refund:'Refund', store_credit:'Store Credit', exchange:'Exchange' };

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['Return No','Date','Sale No','Patient','Phone','Outcome','Total','Reason','By'];
  const csvRows = rows.map((r:any) => [
    r.return_no, new Date(r.created_at).toLocaleString('en-PK'), r.sale_no, r.patient_name, r.patient_phone||'',
    OUTCOME_LABELS[r.outcome]||r.outcome, r.total, r.reason||'', r.created_by_name
  ]);
  const csv = [headers,...csvRows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Return-Report-${from}-to-${to}.csv`; a.click();
}

export default function ReturnsSection({ from, to }: { from: string; to: string }) {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/pharmacy/returns?from=${from}&to=${to}`)
      .then(d => { if (active) setReturns(d.returns || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const totalValue = returns.reduce((s, r) => s + r.total, 0);
  const totalRefund = returns.reduce((s, r) => s + (r.refund_amount || 0), 0);
  const totalCredit = returns.reduce((s, r) => s + (r.credit_amount || 0), 0);

  const byDayMap = new Map<string, { date: string; count: number; total: number }>();
  for (const r of returns) {
    const d = r.created_at.slice(0, 10);
    const e = byDayMap.get(d) || { date: d, count: 0, total: 0 };
    e.count += 1; e.total += r.total;
    byDayMap.set(d, e);
  }
  const byDayData = [...byDayMap.values()].sort((a,b) => a.date.localeCompare(b.date)).map(r => ({ ...r, date: r.date.slice(5) }));

  const byOutcomeMap = new Map<string, { name: string; total: number; count: number }>();
  for (const r of returns) {
    const label = OUTCOME_LABELS[r.outcome] || r.outcome;
    const e = byOutcomeMap.get(label) || { name: label, total: 0, count: 0 };
    e.total += r.total; e.count += 1;
    byOutcomeMap.set(label, e);
  }
  const byOutcomeData = [...byOutcomeMap.values()];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => exportCSV(returns, from, to)} disabled={loading||!returns.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label:'Total Returns', value: returns.length, icon: RotateCcw, tint:'bg-navy-50 text-navy-700' },
          { label:'Total Value', value:`Rs. ${totalValue.toLocaleString()}`, icon: Banknote, tint:'bg-sky-50 text-sky-700' },
          { label:'Refunded', value:`Rs. ${totalRefund.toLocaleString()}`, icon: Banknote, tint:'bg-crimson-50 text-crimson-700' },
          { label:'Store Credit Issued', value:`Rs. ${totalCredit.toLocaleString()}`, icon: Wallet, tint:'bg-emerald-50 text-emerald-700' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={16}/></div>
            <p className="text-xl font-display font-bold text-navy-900 mt-2">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">Returns by Day</h2>
        {byDayData.length === 0 ? <p className="text-sm text-gray-400">No returns in this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="date" tick={{ fontSize: 11 }}/>
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false}/>
              <Tooltip formatter={(v:any, n:string) => n==='total' ? `Rs. ${Number(v).toLocaleString()}` : v}/>
              <Bar dataKey="count" fill="#13244a" name="Returns" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">By Outcome</h2>
        {byOutcomeData.length === 0 ? <p className="text-sm text-gray-400">No data.</p> : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={byOutcomeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis type="number" tick={{fontSize:11}}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={100}/>
              <Tooltip formatter={(v:any) => `Rs. ${Number(v).toLocaleString()}`}/>
              <Bar dataKey="total" name="Value" radius={[0,4,4,0]}>
                {byOutcomeData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">All Returns ({returns.length})</h2>
          <button onClick={() => exportCSV(returns, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
            {['Return No','Date','Sale No','Patient','Outcome','Total'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && returns.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No returns in this range.</td></tr>}
            {returns.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                onClick={() => window.open(`/dashboard/pharmacy/returns/${r.id}`, '_blank')}>
                <td className="px-4 py-3 font-mono-num text-navy-800">{r.return_no}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-3 font-mono-num text-gray-600">{r.sale_no}</td>
                <td className="px-4 py-3 font-medium text-navy-900">{r.patient_name}</td>
                <td className="px-4 py-3"><span className="kmc-badge bg-navy-50 text-navy-700 capitalize">{r.outcome.replace('_',' ')}</span></td>
                <td className="px-4 py-3 font-mono-num font-semibold">Rs. {r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
