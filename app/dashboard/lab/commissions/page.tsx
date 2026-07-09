'use client';
import { useEffect, useState } from 'react';
import { Download, Banknote } from 'lucide-react';
import { api } from '@/lib/api-client';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['Referring Doctor', 'Orders', 'Revenue', 'Commission %', 'Commission Payable'];
  const data = rows.map(r => [r.doctor_name, r.count, r.revenue, r.commission_percent ?? 0, r.commission_amount]);
  const csv = [headers, ...data].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `Lab-Commissions-${from}-to-${to}.csv`; a.click();
}

export default function LabCommissionsPage() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true; setLoading(true);
    api.get(`/api/lab/reports?from=${from}&to=${to}`)
      .then(d => { if (active) setRows(d.byReferringDoctor || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const totalCommission = rows.reduce((s, r) => s + (r.commission_amount || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2"><Banknote size={22} className="text-sky-600"/> Referral Commissions</h1>
          <p className="text-sm text-gray-500 mt-1">Revenue and commission payable per referring doctor.</p>
        </div>
        <button onClick={() => exportCSV(rows, from, to)} disabled={loading || !rows.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <input type="date" className="kmc-input max-w-[160px]" value={from} onChange={e => setFrom(e.target.value)}/>
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" className="kmc-input max-w-[160px]" value={to} onChange={e => setTo(e.target.value)}/>
        <div className="flex gap-2 ml-auto">
          {[['30 Days',29],['90 Days',89]].map(([l,n]) => (
            <button key={l} onClick={() => { setFrom(daysAgo(n as number)); setTo(todayStr()); }} className="kmc-btn-ghost text-xs px-3 py-1.5">{l}</button>
          ))}
        </div>
      </div>

      <div className="kmc-card p-5">
        <p className="kmc-label">Total Commission Payable</p>
        <p className="text-2xl font-display font-bold text-navy-900 mt-1">Rs. {totalCommission.toLocaleString()}</p>
      </div>

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Doctor', 'Orders', 'Revenue', 'Commission %', 'Commission Payable'].map(h => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No referred orders in this range.</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.doctor_name} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-900">{r.doctor_name}</td>
                <td className="px-5 py-3 text-gray-500">{r.count}</td>
                <td className="px-5 py-3 font-mono-num text-navy-800">Rs. {Number(r.revenue).toLocaleString()}</td>
                <td className="px-5 py-3 text-gray-500">{r.commission_percent ?? 0}%</td>
                <td className="px-5 py-3 font-mono-num font-semibold text-emerald-700">Rs. {Number(r.commission_amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
