'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Printer, Wallet, TestTube, TrendingDown, Clock, AlertOctagon } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

const PAY_LABELS: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };
const COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b'];
const STATUS_COLORS: Record<string,string> = { pending:'#f59e0b', processing:'#0ea5e9', completed:'#10b981', cancelled:'#9ca3af' };

function exportCSV(orders: any[], from: string, to: string) {
  if (!orders.length) return;
  const headers = ['Order No','Date','Patient','Phone','Age','Gender','Referred By','Total','Discount','Paid','Balance','Pay Status','Order Status','Booked By'];
  const rows = orders.map((o: any) => [
    o.order_no, new Date(o.created_at).toLocaleString('en-PK'), o.patient_name, o.patient_phone||'',
    o.patient_age||'', o.patient_gender||'', o.referring_doctor||'',
    o.total, o.discount, o.paid_amount, o.total - o.paid_amount,
    o.payment_status, o.status, o.booked_by_name
  ]);
  const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `Lab-Report-${from}-to-${to}.csv`; a.click();
}

export default function LabReportsPage() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(todayStr());
  const [report, setReport] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true; setLoading(true);
    Promise.all([
      api.get(`/api/lab/reports?from=${from}&to=${to}`),
      api.get(`/api/lab/orders?from=${from}&to=${to}`)
    ]).then(([r, o]) => { if (active) { setReport(r); setOrders(o.orders || []); } })
    .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const byDayData = (report?.byDay || []).map((r: any) => ({ date: r.date.slice(5), orders: r.count, collected: r.collected }));
  const byPayData = (report?.byPaymentMethod || []).map((r: any) => ({ name: PAY_LABELS[r.payment_method] || r.payment_method, value: r.count, collected: r.collected }));
  const byStatusData = (report?.byStatus || []).map((r: any) => ({ name: r.status, value: r.count }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Lab Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Revenue, top tests and daily order breakdown.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCSV(orders, from, to)} disabled={loading || !orders.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
            <Download size={15}/> Export CSV
          </button>
          <button onClick={() => window.print()} className="kmc-btn-ghost flex items-center gap-2 text-sm">
            <Printer size={15}/> Print
          </button>
        </div>
      </div>

      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <input type="date" className="kmc-input max-w-[160px]" value={from} onChange={e => setFrom(e.target.value)}/>
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" className="kmc-input max-w-[160px]" value={to} onChange={e => setTo(e.target.value)}/>
        <div className="flex gap-2 ml-auto">
          {[['Today',0],['7 Days',6],['30 Days',29]].map(([l,n]) => (
            <button key={l} onClick={() => { setFrom(daysAgo(n as number)); setTo(todayStr()); }} className="kmc-btn-ghost text-xs px-3 py-1.5">{l}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Total Orders', value: report?.totals?.total_orders ?? 0, icon: TestTube, tint:'bg-sky-50 text-sky-700' },
          { label:'Total Collected', value:`Rs. ${Number(report?.totals?.total_collected ?? 0).toLocaleString()}`, icon: Wallet, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Outstanding', value:`Rs. ${Math.max(Number(report?.totals?.total_billed ?? 0) - Number(report?.totals?.total_collected ?? 0), 0).toLocaleString()}`, icon: TrendingDown, tint:'bg-crimson-50 text-crimson-700' }
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* TAT / rejected samples */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Avg. TAT (hrs)', value: report?.tat?.avg_hours != null ? Number(report.tat.avg_hours).toFixed(1) : '—', icon: Clock, tint:'bg-navy-50 text-navy-700' },
          { label:'SLA Breaches', value: `${report?.tat?.breach_count ?? 0} of ${report?.tat?.total_reported ?? 0}`, icon: AlertOctagon, tint:'bg-amber-50 text-amber-700' },
          { label:'Sample Rejection Rate', value: `${((report?.rejectedSamples?.rejection_rate ?? 0) * 100).toFixed(1)}%`, icon: AlertOctagon, tint:'bg-crimson-50 text-crimson-700' }
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">Daily Orders</h2>
        {byDayData.length === 0 ? <p className="text-sm text-gray-400">No data for this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="date" tick={{ fontSize:11 }}/>
              <YAxis yAxisId="l" tick={{ fontSize:11 }} allowDecimals={false}/>
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize:11 }}/>
              <Tooltip formatter={(v: any, n: string) => n === 'collected' ? `Rs. ${Number(v).toLocaleString()}` : v}/>
              <Bar yAxisId="l" dataKey="orders" fill="#13244a" name="Orders" radius={[4,4,0,0]}/>
              <Bar yAxisId="r" dataKey="collected" fill="#d62828" name="Collected (Rs.)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Status pie */}
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">By Status</h2>
          {byStatusData.length === 0 ? <p className="text-sm text-gray-400">No data.</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {byStatusData.map((e: any) => <Cell key={e.name} fill={STATUS_COLORS[e.name] || '#9ca3af'}/>)}
                </Pie>
                <Tooltip/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By payment method */}
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">By Payment Method</h2>
          <div className="space-y-2.5">
            {byPayData.length === 0 && <p className="text-sm text-gray-400">No data.</p>}
            {byPayData.map((r: any, i: number) => (
              <div key={r.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }}/>
                  <span className="text-gray-700">{r.name}</span>
                </span>
                <span className="text-right">
                  <span className="text-gray-500 text-xs">{r.value} orders</span>
                  <span className="font-mono-num font-semibold text-navy-900 ml-2">Rs. {Number(r.collected).toLocaleString()}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top tests */}
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">Top Tests</h2>
          <div className="space-y-2">
            {(report?.topTests || []).length === 0 && <p className="text-sm text-gray-400">No data.</p>}
            {(report?.topTests || []).map((t: any, i: number) => (
              <div key={t.test_name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ background: COLORS[i % COLORS.length] }}>{i+1}</span>
                  <span className="truncate max-w-[120px]">{t.test_name}</span>
                </span>
                <span className="text-gray-500 text-xs">{t.count}× — <span className="font-mono-num font-semibold text-navy-900">Rs. {Number(t.revenue).toLocaleString()}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Referring doctors + rejected samples */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="kmc-card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-display font-semibold text-navy-900">By Referring Doctor</h2>
            <Link href="/dashboard/lab/commissions" className="text-xs font-semibold text-navy-700 hover:text-crimson-600">Commissions &rarr;</Link>
          </div>
          <div className="p-5 space-y-2">
            {(report?.byReferringDoctor || []).length === 0 && <p className="text-sm text-gray-400">No data for this range.</p>}
            {(report?.byReferringDoctor || []).map((r: any) => (
              <div key={r.doctor_name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{r.doctor_name}</span>
                <span className="text-gray-500">{r.count} orders — <span className="font-mono-num font-semibold text-navy-900">Rs. {Number(r.revenue).toLocaleString()}</span></span>
              </div>
            ))}
          </div>
        </div>
        <div className="kmc-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-display font-semibold text-navy-900">Rejected Samples by Reason</h2>
          </div>
          <div className="p-5 space-y-2">
            {(report?.rejectedSamples?.byReason || []).length === 0 && <p className="text-sm text-gray-400">No rejections in this range.</p>}
            {(report?.rejectedSamples?.byReason || []).map((r: any) => (
              <div key={r.reason} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{r.reason}</span>
                <span className="font-mono-num font-semibold text-navy-900">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By staff */}
      <div className="kmc-card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-navy-900">By Staff Member</h2>
        </div>
        <div className="p-5 space-y-2">
          {(report?.byUser || []).length === 0 && <p className="text-sm text-gray-400">No data for this range.</p>}
          {(report?.byUser || []).map((r: any) => (
            <div key={r.user_name} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{r.user_name}</span>
              <span className="text-gray-500">{r.count} orders — <span className="font-mono-num font-semibold text-navy-900">Rs. {Number(r.collected).toLocaleString()}</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Full detail table */}
      <div className="kmc-card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">All Orders — Full Detail ({orders.length})</h2>
          <button onClick={() => exportCSV(orders, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
                {['Order No','Date','Patient','Phone','Total','Paid','Balance','Pay Status','Status','Booked By'].map(h =>
                  <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>}
              {!loading && orders.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No orders in this range.</td></tr>}
              {orders.map((o: any) => (
                <tr key={o.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                  onClick={() => window.open(`/dashboard/lab/orders/${o.id}`, '_blank')}>
                  <td className="px-4 py-2.5 font-mono-num text-navy-800">{o.order_no}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(o.created_at).toLocaleString('en-PK')}</td>
                  <td className="px-4 py-2.5 font-medium text-navy-900">{o.patient_name}</td>
                  <td className="px-4 py-2.5 font-mono-num text-gray-400">{o.patient_phone || '—'}</td>
                  <td className="px-4 py-2.5 font-mono-num font-semibold text-navy-900">Rs. {o.total}</td>
                  <td className="px-4 py-2.5 font-mono-num text-emerald-700">Rs. {o.paid_amount}</td>
                  <td className="px-4 py-2.5 font-mono-num text-crimson-600">Rs. {o.total - o.paid_amount}</td>
                  <td className="px-4 py-2.5"><span className={`kmc-badge ${o.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : o.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'}`}>{o.payment_status}</span></td>
                  <td className="px-4 py-2.5"><span className="kmc-badge" style={{ background: STATUS_COLORS[o.status] + '20', color: STATUS_COLORS[o.status] }}>{o.status}</span></td>
                  <td className="px-4 py-2.5 text-gray-400">{o.booked_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
