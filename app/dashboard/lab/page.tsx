'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TestTube, Wallet, Clock, CheckCircle2, Plus, ArrowRight, AlertTriangle, PhoneCall } from 'lucide-react';
import { api } from '@/lib/api-client';

function todayStr() { return new Date().toISOString().slice(0, 10); }

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', processing: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-gray-200 text-gray-600'
};

export default function LabPage() {
  const [report, setReport] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [critical, setCritical] = useState<any[]>([]);
  const [lowStockReagents, setLowStockReagents] = useState<any[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [notifyBusy, setNotifyBusy] = useState<number | null>(null);

  async function loadAlerts() {
    try {
      const [c, r] = await Promise.all([
        api.get('/api/lab/critical-results'),
        api.get('/api/lab/reagents')
      ]);
      setCritical(c.results || []);
      setLowStockReagents(r.lowStock || []);
      setExpiringBatches(r.expiringSoon || []);
    } catch { /* alerts are best-effort */ }
  }

  useEffect(() => {
    const date = todayStr();
    Promise.all([
      api.get(`/api/lab/reports?from=${date}&to=${date}`),
      api.get(`/api/lab/orders?date=${date}`)
    ]).then(([r, o]) => { setReport(r); setOrders((o.orders || []).slice(0, 10)); })
    .catch(() => {}).finally(() => setLoading(false));
    loadAlerts();
  }, []);

  async function notifyDoctor(resultId: number) {
    setNotifyBusy(resultId);
    try { await api.post(`/api/lab/results/${resultId}/notify`, {}); await loadAlerts(); }
    finally { setNotifyBusy(null); }
  }

  const byStatus = report?.byStatus || [];
  const pendingCount = byStatus.find((s: any) => s.status === 'pending')?.count || 0;
  const completedCount = byStatus.find((s: any) => s.status === 'completed')?.count || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2">
            <TestTube size={22} className="text-sky-600" /> Laboratory
          </h1>
          <p className="text-sm text-gray-500 mt-1">Patient test orders, results tracking and daily reports.</p>
        </div>
        <Link href="/dashboard/lab/orders/new" className="kmc-btn-accent flex items-center gap-2">
          <Plus size={16} /> New Order
        </Link>
      </div>

      {critical.length > 0 && (
        <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-800 text-sm">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={16}/> Critical Results Awaiting Notification</div>
          <div className="mt-2 space-y-1.5">
            {critical.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-2 bg-white/60 rounded-lg px-3 py-2">
                <span>
                  <Link href={`/dashboard/lab/orders/${r.order_id}`} className="font-mono-num hover:underline">{r.order_no}</Link>
                  {' — '}{r.patient_name} · {r.test_name}: <strong>{r.value_numeric ?? r.value_text}{r.unit ? ` ${r.unit}` : ''}</strong>
                </span>
                <button disabled={notifyBusy === r.id} onClick={() => notifyDoctor(r.id)} className="kmc-btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 shrink-0">
                  <PhoneCall size={12}/> {notifyBusy === r.id ? 'Saving...' : 'Log: Doctor Notified'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(lowStockReagents.length > 0 || expiringBatches.length > 0) && (
        <div className="kmc-card p-4 border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={16}/> Reagent Stock Alerts</div>
          {lowStockReagents.length > 0 && <p className="mt-1">Low stock: {lowStockReagents.map((r: any) => `${r.name} (${r.stock_qty} ${r.unit})`).join(', ')}</p>}
          {expiringBatches.length > 0 && <p className="mt-1">Expiring within 30 days: {expiringBatches.map((b: any) => `${b.reagent_name} (${b.batch_no})`).join(', ')}</p>}
          <Link href="/dashboard/lab/reagents" className="text-xs font-semibold hover:underline mt-1 inline-block">Manage reagents &rarr;</Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Today's Orders", value: report?.totals?.total_orders ?? 0, icon: TestTube, tint: 'bg-sky-50 text-sky-700' },
          { label: "Today's Collection", value: `Rs. ${Number(report?.totals?.total_collected ?? 0).toLocaleString()}`, icon: Wallet, tint: 'bg-emerald-50 text-emerald-700' },
          { label: 'Pending Results', value: pendingCount, icon: Clock, tint: 'bg-amber-50 text-amber-700' },
          { label: 'Completed Today', value: completedCount, icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-700' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18} /></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-navy-900">Today's Lab Orders</h2>
          <Link href="/dashboard/lab/orders" className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                {['Order No','Patient','Tests','Total','Payment','Status','Booked By'].map(h =>
                  <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
              {!loading && orders.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No orders today.</td></tr>}
              {orders.map((o: any) => (
                <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                  onClick={() => window.location.href = `/dashboard/lab/orders/${o.id}`}>
                  <td className="px-5 py-3 font-mono-num text-navy-800">{o.order_no}</td>
                  <td className="px-5 py-3 font-medium text-navy-900">{o.patient_name}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{o.item_count || '—'} test(s)</td>
                  <td className="px-5 py-3 font-mono-num font-semibold">Rs. {o.total}</td>
                  <td className="px-5 py-3">
                    <span className={`kmc-badge ${o.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : o.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'}`}>{o.payment_status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`kmc-badge ${STATUS_STYLES[o.status] || 'bg-gray-100 text-gray-700'}`}>{o.status}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{o.booked_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
