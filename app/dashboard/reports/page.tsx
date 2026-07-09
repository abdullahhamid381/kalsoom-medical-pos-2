'use client';

import { useEffect, useState, useRef } from 'react';
import { Wallet, CalendarCheck2, TrendingDown, Download, Printer } from 'lucide-react';
import { api } from '@/lib/api-client';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgoStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10);
}

const PAY_LABELS: Record<string, string> = {
  cash: 'Cash', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa', bank_transfer: 'Bank Transfer', card: 'Card'
};
const PIE_COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b','#8b5cf6'];

function exportCSV(appointments: any[], from: string, to: string) {
  const headers = [
    'Appointment No','Token','Date','Time','Patient','Phone','CNIC','Age','Gender',
    'Doctor','Specialization','Department','Reason','Payment Method',
    'Fee','Discount','Paid','Payment Status','Status','Booked By','Created At'
  ];
  const rows = appointments.map((a: any) => [
    a.appointment_no, a.token_number, a.appointment_date, a.appointment_time,
    a.patient_name, a.patient_phone, a.patient_cnic || '',
    a.patient_age || '', a.patient_gender || '',
    a.doctor_name, a.specialization, a.department || '', a.reason || '',
    PAY_LABELS[a.payment_method] || a.payment_method,
    a.amount, a.discount, a.paid_amount, a.payment_status, a.status,
    a.booked_by_name, a.created_at
  ]);
  const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `KMC-Report-${from}-to-${to}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgoStr(6));
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const [reportRes, apptRes] = await Promise.all([
          api.get(`/api/reports?from=${from}&to=${to}`),
          api.get(`/api/appointments?from=${from}&to=${to}`)
        ]);
        if (!active) return;
        setData(reportRes);
        setAppointments(apptRes.appointments || []);
      } catch (err: any) { if (active) setError(err.message); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [from, to]);

  function quickRange(n: number) { setFrom(daysAgoStr(n)); setTo(todayStr()); }

  const byDayData = (data?.byDay || []).map((r: any) => ({
    date: r.date.slice(5),
    appointments: r.count,
    collected: r.collected
  }));
  const byPayData = (data?.byPaymentMethod || []).map((r: any) => ({
    name: PAY_LABELS[r.payment_method] || r.payment_method,
    value: r.count,
    collected: r.collected
  }));
  const byStatusData = (data?.byStatus || []).map((r: any) => ({
    name: r.status.replace('_', ' '),
    value: r.count
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Revenue, activity and full booking detail for any date range.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => !loading && appointments.length > 0 && exportCSV(appointments, from, to)}
            disabled={loading || appointments.length === 0}
            className="kmc-btn-ghost flex items-center gap-2 text-sm"
          >
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="kmc-btn-ghost flex items-center gap-2 text-sm">
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* Date range controls */}
      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <input type="date" className="kmc-input max-w-[160px]" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" className="kmc-input max-w-[160px]" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex gap-2 ml-auto">
          {[['Today', 0], ['7 Days', 6], ['30 Days', 29], ['90 Days', 89]].map(([label, n]) => (
            <button key={label} onClick={() => quickRange(n as number)} className="kmc-btn-ghost text-xs px-3 py-1.5">
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Appointments', icon: CalendarCheck2, tint: 'bg-navy-50 text-navy-700', value: data?.totals?.total_appointments ?? 0 },
          { label: 'Total Collected', icon: Wallet, tint: 'bg-emerald-50 text-emerald-700', value: `Rs. ${Number(data?.totals?.total_collected ?? 0).toLocaleString()}` },
          { label: 'Outstanding Balance', icon: TrendingDown, tint: 'bg-crimson-50 text-crimson-700',
            value: `Rs. ${Math.max(Number(data?.totals?.total_billed ?? 0) - Number(data?.totals?.total_collected ?? 0), 0).toLocaleString()}` }
        ].map((c) => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}>
              <c.icon size={18} />
            </div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Daily appointments + revenue bar chart */}
        <div className="kmc-card p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Daily Activity</h2>
          {byDayData.length === 0 ? (
            <p className="text-sm text-gray-400">No data for this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byDayData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: any, name: string) =>
                    name === 'collected' ? `Rs. ${Number(value).toLocaleString()}` : value
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="appointments" fill="#13244a" name="Appointments" radius={[4,4,0,0]} />
                <Bar yAxisId="right" dataKey="collected" fill="#d62828" name="Collected (Rs.)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment method pie */}
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">By Payment Method</h2>
          {byPayData.length === 0 ? (
            <p className="text-sm text-gray-400">No data for this range.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={byPayData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {byPayData.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `${value} visits`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {byPayData.map((r: any, i: number) => (
                  <div key={r.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {r.name}
                    </span>
                    <span className="font-mono-num font-semibold text-navy-900">Rs. {Number(r.collected).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Status breakdown */}
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Appointment Status Breakdown</h2>
          {byStatusData.length === 0 ? (
            <p className="text-sm text-gray-400">No data for this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byStatusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" name="Count" radius={[0,4,4,0]}>
                  {byStatusData.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By doctor */}
        <div className="kmc-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-display font-semibold text-navy-900">By Doctor</h2>
          </div>
          <div className="p-5 space-y-2">
            {(data?.byDoctor || []).length === 0 && <p className="text-sm text-gray-400">No data for this range.</p>}
            {(data?.byDoctor || []).map((row: any) => (
              <div key={row.doctor_name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{row.doctor_name}</span>
                <span className="text-gray-500">
                  {row.count} visits —{' '}
                  <span className="font-mono-num font-semibold text-navy-900">Rs. {Number(row.collected).toLocaleString()}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* By staff */}
        <div className="kmc-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-display font-semibold text-navy-900">By Staff Member</h2>
          </div>
          <div className="p-5 space-y-2">
            {(data?.byUser || []).length === 0 && <p className="text-sm text-gray-400">No data for this range.</p>}
            {(data?.byUser || []).map((row: any) => (
              <div key={row.user_name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{row.user_name}</span>
                <span className="text-gray-500">
                  {row.count} bookings —{' '}
                  <span className="font-mono-num font-semibold text-navy-900">Rs. {Number(row.collected).toLocaleString()}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full A-to-Z booking detail table */}
      <div className="kmc-card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">
            All Bookings — A to Z Detail ({appointments.length})
          </h2>
          <button
            onClick={() => !loading && appointments.length > 0 && exportCSV(appointments, from, to)}
            disabled={loading || appointments.length === 0}
            className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1"
          >
            <Download size={13} /> Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
                {['No.','Token','Date','Time','Patient','Phone','Doctor','Method','Fee','Disc.','Paid','Pay Status','Status','Booked By'].map(h => (
                  <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              )}
              {!loading && appointments.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-400">No appointments in this date range.</td></tr>
              )}
              {appointments.map((a: any) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                  onClick={() => window.open(`/dashboard/appointments/${a.id}`, '_blank')}
                >
                  <td className="px-4 py-2.5 font-mono-num text-navy-800 whitespace-nowrap">{a.appointment_no}</td>
                  <td className="px-4 py-2.5 font-mono-num font-bold text-navy-600">#{a.token_number}</td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{a.appointment_date}</td>
                  <td className="px-4 py-2.5 font-mono-num text-gray-500">{a.appointment_time}</td>
                  <td className="px-4 py-2.5 text-navy-900 font-medium whitespace-nowrap">{a.patient_name}</td>
                  <td className="px-4 py-2.5 font-mono-num text-gray-500">{a.patient_phone}</td>
                  <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{a.doctor_name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{PAY_LABELS[a.payment_method] || a.payment_method}</td>
                  <td className="px-4 py-2.5 font-mono-num text-gray-700">{a.amount}</td>
                  <td className="px-4 py-2.5 font-mono-num text-gray-500">{a.discount}</td>
                  <td className="px-4 py-2.5 font-mono-num font-semibold text-navy-900">{a.paid_amount}</td>
                  <td className="px-4 py-2.5">
                    <span className={`kmc-badge ${
                      a.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800'
                      : a.payment_status === 'partial' ? 'bg-amber-100 text-amber-800'
                      : 'bg-crimson-100 text-crimson-800'}`}>
                      {a.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`kmc-badge ${
                      a.status === 'completed' ? 'bg-emerald-100 text-emerald-800'
                      : a.status === 'checked_in' ? 'bg-sky-100 text-sky-800'
                      : a.status === 'confirmed' ? 'bg-navy-100 text-navy-800'
                      : a.status === 'cancelled' ? 'bg-gray-200 text-gray-600'
                      : 'bg-amber-100 text-amber-800'}`}>
                      {a.status.replace('_',' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">{a.booked_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
