'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api-client';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }

export default function ReturnsListPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(todayStr());

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (q.trim()) params.set('q', q.trim());
    api.get(`/api/pharmacy/returns?${params}`)
      .then(d => setReturns(d.returns || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Sale Returns</h1>
        <p className="text-sm text-gray-500 mt-1">Customer returns, refunds, and store credit issued.</p>
      </div>

      <div className="kmc-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="kmc-input pl-9" placeholder="Search sale no, return no, patient..." value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <input type="date" className="kmc-input" value={from} onChange={e => setFrom(e.target.value)}/>
        <input type="date" className="kmc-input" value={to} onChange={e => setTo(e.target.value)}/>
      </div>

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Return No.','Date','Sale No.','Patient','Outcome','Total','By'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && returns.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No returns found.</td></tr>}
            {returns.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                onClick={() => window.location.href = `/dashboard/pharmacy/returns/${r.id}`}>
                <td className="px-4 py-3 font-mono-num text-navy-800">{r.return_no}</td>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-3 font-mono-num text-gray-600">{r.sale_no}</td>
                <td className="px-4 py-3 font-medium text-navy-900">{r.patient_name}</td>
                <td className="px-4 py-3"><span className="kmc-badge bg-navy-50 text-navy-700 capitalize">{r.outcome.replace('_',' ')}</span></td>
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
