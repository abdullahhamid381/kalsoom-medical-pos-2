'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck2, Wallet, AlertCircle, XCircle, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api-client';
import StatusBadge from '@/components/StatusBadge';
import { useSession } from '@/lib/session-context';
import { formatTime12h } from '@/lib/format';

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function OverviewPage() {
  const session = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totals, setTotals] = useState<any>(null);
  const [byStatus, setByStatus] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const isDoctor = session?.role === 'doctor';

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError('');
      try {
        const date = todayStr();
        const [reportData, apptData] = await Promise.all([
          api.get(`/api/reports?from=${date}&to=${date}`),
          api.get(`/api/appointments?date=${date}`)
        ]);
        if (!active) return;
        setTotals(reportData.totals);
        setByStatus(reportData.byStatus || []);
        setRecent((apptData.appointments || []).slice(0, 10));
      } catch (err: any) { if (active) setError(err.message); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, []);

  const pendingCount = byStatus.find(s => s.status === 'pending')?.count || 0;
  const cancelledCount = byStatus.find(s => s.status === 'cancelled')?.count || 0;
  const checkedInCount = byStatus.find(s => s.status === 'checked_in')?.count || 0;
  const completedCount = byStatus.find(s => s.status === 'completed')?.count || 0;

  const cards = [
    { label: "Today's Appointments", value: totals?.total_appointments ?? 0, icon: CalendarCheck2, tint: 'bg-navy-50 text-navy-700' },
    { label: "Today's Collection", value: `Rs. ${Number(totals?.total_collected ?? 0).toLocaleString()}`, icon: Wallet, tint: 'bg-emerald-50 text-emerald-700', hide: isDoctor },
    { label: 'Checked-In / Waiting', value: checkedInCount, icon: AlertCircle, tint: 'bg-sky-50 text-sky-700' },
    { label: isDoctor ? 'Completed Today' : 'Cancelled Today', value: isDoctor ? completedCount : cancelledCount, icon: XCircle, tint: 'bg-crimson-50 text-crimson-700' }
  ].filter(c => !c.hide);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">
          {isDoctor ? `Dr. ${session?.name}'s Dashboard` : 'Overview'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isDoctor ? 'Your patients and appointments for today.' : "A quick snapshot of today's activity at the front desk."}
        </p>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}>
              <c.icon size={18} />
            </div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-navy-900">Today's Appointments</h2>
          <Link href="/dashboard/appointments" className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-semibold">Token</th>
                <th className="px-5 py-3 font-semibold">Patient</th>
                {!isDoctor && <th className="px-5 py-3 font-semibold">Doctor</th>}
                <th className="px-5 py-3 font-semibold">Time</th>
                <th className="px-5 py-3 font-semibold">Appointment</th>
                {!isDoctor && <th className="px-5 py-3 font-semibold">Payment</th>}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-5 py-6 text-center text-gray-400">Loading...</td></tr>}
              {!loading && recent.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No appointments booked yet today.</td></tr>
              )}
              {recent.map(a => (
                <tr
                  key={a.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                  onClick={() => window.location.href = `/dashboard/appointments/${a.id}`}
                >
                  <td className="px-5 py-3 font-mono-num font-semibold text-navy-800">#{a.token_number}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy-900">{a.patient_name}</p>
                    <p className="text-xs text-gray-400 font-mono-num">{a.patient_phone}</p>
                  </td>
                  {!isDoctor && <td className="px-5 py-3 text-gray-700">{a.doctor_name}</td>}
                  <td className="px-5 py-3 font-mono-num text-gray-700">{formatTime12h(a.appointment_time)}</td>
                  {/* Two status badges: appointment status + payment status */}
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge value={a.status} />
                    </div>
                  </td>
                  {!isDoctor && (
                    <td className="px-5 py-3">
                      <StatusBadge value={a.payment_status} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
