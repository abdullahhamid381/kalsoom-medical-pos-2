'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, X } from 'lucide-react';
import { api } from '@/lib/api-client';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }

export default function SalesListPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [payStatus, setPayStatus] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (q.trim()) params.set('q', q.trim());
    api.get(`/api/pharmacy/sales?${params}`)
      .then(d => { if (active) setSales(d.sales || []); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, q]);

  const filtered = payStatus ? sales.filter(s => s.payment_status === payStatus) : sales;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Pharmacy Sales</h1>
          <p className="text-sm text-gray-500 mt-1">All medicine sales records.</p>
        </div>
        <Link href="/dashboard/pharmacy/sales/new" className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>New Sale</Link>
      </div>

      <div className="kmc-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="kmc-input pl-9" placeholder="Search patient, phone, sale no..." value={q} onChange={e => setQ(e.target.value)}/>
        </div>
        <input type="date" className="kmc-input" value={from} onChange={e => setFrom(e.target.value)}/>
        <input type="date" className="kmc-input" value={to} onChange={e => setTo(e.target.value)}/>
        <div className="flex items-center gap-2">
          <select className="kmc-input" value={payStatus} onChange={e => setPayStatus(e.target.value)}>
            <option value="">All Payment Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <div className="flex gap-1">
            {[['Today',0],['7d',6],['30d',29]].map(([l,n]) => (
              <button key={l} onClick={() => { setFrom(daysAgo(n as number)); setTo(todayStr()); }}
                className="kmc-btn-ghost text-xs px-2 py-1.5 whitespace-nowrap">{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Sale No','Date & Time','Patient','Phone','Total','Paid','Method','Status','By'].map(h =>
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">No sales found.</td></tr>}
            {filtered.map((s: any) => (
              <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                onClick={() => window.location.href = `/dashboard/pharmacy/sales/${s.id}`}>
                <td className="px-4 py-3 font-mono-num text-navy-800 whitespace-nowrap">{s.sale_no}</td>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{new Date(s.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-3 font-medium text-navy-900">{s.patient_name}</td>
                <td className="px-4 py-3 font-mono-num text-gray-500 text-xs">{s.patient_phone || '—'}</td>
                <td className="px-4 py-3 font-mono-num font-semibold">Rs. {s.total}</td>
                <td className="px-4 py-3 font-mono-num text-gray-600">Rs. {s.paid_amount}</td>
                <td className="px-4 py-3 text-gray-500 capitalize text-xs">{s.payment_method.replace('_',' ')}</td>
                <td className="px-4 py-3">
                  <span className={`kmc-badge ${s.payment_status==='paid' ? 'bg-emerald-100 text-emerald-800' : s.payment_status==='partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'}`}>
                    {s.payment_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{s.sold_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
