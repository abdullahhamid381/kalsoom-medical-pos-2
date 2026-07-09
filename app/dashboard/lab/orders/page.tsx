'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Plus } from 'lucide-react';
import { api } from '@/lib/api-client';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', processing: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-gray-200 text-gray-600'
};
const PRIORITY_STYLES: Record<string, string> = {
  routine: 'bg-gray-100 text-gray-600', urgent: 'bg-amber-100 text-amber-800', stat: 'bg-crimson-100 text-crimson-800'
};

export default function LabOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  useEffect(() => {
    let active = true; setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);
    api.get(`/api/lab/orders?${params}`)
      .then(d => { if (active) setOrders(d.orders || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, q, status, priority]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold text-navy-900">Lab Orders</h1><p className="text-sm text-gray-500 mt-1">All patient test orders.</p></div>
        <Link href="/dashboard/lab/orders/new" className="kmc-btn-accent flex items-center gap-2"><Plus size={16} /> New Order</Link>
      </div>
      <div className="kmc-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input className="kmc-input pl-9" placeholder="Search patient, phone, order no..." value={q} onChange={e => setQ(e.target.value)} /></div>
        <input type="date" className="kmc-input" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" className="kmc-input" value={to} onChange={e => setTo(e.target.value)} />
        <select className="kmc-input" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="kmc-input" value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="">All Priorities</option>
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="stat">STAT</option>
        </select>
        <div className="flex gap-1">
          {[['Today',0],['7d',6],['30d',29]].map(([l,n]) => (
            <button key={l} onClick={() => { setFrom(daysAgo(n as number)); setTo(todayStr()); }} className="kmc-btn-ghost text-xs px-2 py-1.5">{l}</button>
          ))}
        </div>
      </div>
      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Order No','Date','Patient','Phone','Priority','Total','Paid','Pay Status','Order Status','Booked By'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && orders.length === 0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-gray-400">No orders found.</td></tr>}
            {orders.map((o: any) => (
              <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer" onClick={() => window.location.href = `/dashboard/lab/orders/${o.id}`}>
                <td className="px-4 py-3 font-mono-num text-navy-800">{o.order_no}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(o.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-3 font-medium text-navy-900">{o.patient_name}</td>
                <td className="px-4 py-3 font-mono-num text-gray-400 text-xs">{o.patient_phone || '—'}</td>
                <td className="px-4 py-3"><span className={`kmc-badge ${PRIORITY_STYLES[o.priority] || ''}`}>{o.priority || 'routine'}</span></td>
                <td className="px-4 py-3 font-mono-num font-semibold">Rs. {o.total}</td>
                <td className="px-4 py-3 font-mono-num text-gray-600">Rs. {o.paid_amount}</td>
                <td className="px-4 py-3"><span className={`kmc-badge ${o.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : o.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'}`}>{o.payment_status}</span></td>
                <td className="px-4 py-3"><span className={`kmc-badge ${STATUS_STYLES[o.status] || ''}`}>{o.status}</span></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{o.booked_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
