'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, CalendarPlus, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import StatusBadge from '@/components/StatusBadge';

type Doctor = { id: number; name: string };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AppointmentsListPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [date, setDate] = useState(todayStr());
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api
      .get('/api/doctors')
      .then((d) => setDoctors(d.doctors || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (date) params.set('date', date);
        if (doctorId) params.set('doctor_id', doctorId);
        if (status) params.set('status', status);
        if (paymentStatus) params.set('payment_status', paymentStatus);
        if (q.trim()) params.set('q', q.trim());
        const data = await api.get(`/api/appointments?${params.toString()}`);
        if (active) setAppointments(data.appointments || []);
      } catch (err: any) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    const t = setTimeout(load, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [date, doctorId, status, paymentStatus, q]);

  function clearFilters() {
    setDate('');
    setDoctorId('');
    setStatus('');
    setPaymentStatus('');
    setQ('');
  }

  const hasFilters = doctorId || status || paymentStatus || q.trim() || date !== todayStr();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Appointments</h1>
          <p className="text-sm text-gray-500 mt-1">Search, filter and manage all bookings.</p>
        </div>
        <Link href="/dashboard/appointments/new" className="kmc-btn-accent flex items-center gap-2">
          <CalendarPlus size={16} /> New Booking
        </Link>
      </div>

      <div className="kmc-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="kmc-input pl-9"
              placeholder="Search patient, phone, appointment no..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <input type="date" className="kmc-input" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="kmc-input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select className="kmc-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
        <div className="flex items-center justify-between mt-3">
          <select className="kmc-input max-w-[180px]" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            <option value="">All Payment Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs font-semibold text-gray-500 hover:text-crimson-600 flex items-center gap-1">
              <X size={13} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-3 font-semibold">No. / Token</th>
              <th className="px-5 py-3 font-semibold">Patient</th>
              <th className="px-5 py-3 font-semibold">Doctor</th>
              <th className="px-5 py-3 font-semibold">Date / Time</th>
              <th className="px-5 py-3 font-semibold">Payment</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Booked By</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && appointments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                  No appointments match these filters.
                </td>
              </tr>
            )}
            {appointments.map((a) => (
              <tr
                key={a.id}
                className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                onClick={() => (window.location.href = `/dashboard/appointments/${a.id}`)}
              >
                <td className="px-5 py-3">
                  <p className="font-mono-num font-semibold text-navy-800">{a.appointment_no}</p>
                  <p className="text-xs text-gray-400">Token #{a.token_number}</p>
                </td>
                <td className="px-5 py-3">
                  <p className="font-medium text-navy-900">{a.patient_name}</p>
                  <p className="text-xs text-gray-400 font-mono-num">{a.patient_phone}</p>
                </td>
                <td className="px-5 py-3 text-gray-700">{a.doctor_name}</td>
                <td className="px-5 py-3 text-gray-700">
                  <p>{a.appointment_date}</p>
                  <p className="text-xs text-gray-400 font-mono-num">{a.appointment_time}</p>
                </td>
                <td className="px-5 py-3">
                  <StatusBadge value={a.payment_status} />
                </td>
                <td className="px-5 py-3">
                  <StatusBadge value={a.status} />
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">{a.booked_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
