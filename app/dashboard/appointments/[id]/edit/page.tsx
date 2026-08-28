'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Banknote, Smartphone, Landmark, CreditCard, Wallet } from 'lucide-react';
import { api } from '@/lib/api-client';
import { formatTime12h as formatSlot } from '@/lib/format';

type Doctor = { id: number; name: string; specialization: string; fee: number; active: number; slots: string[] };

const PAYMENT_METHODS: { value: string; label: string; icon: any }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'jazzcash', label: 'JazzCash', icon: Smartphone },
  { value: 'easypaisa', label: 'EasyPaisa', icon: Wallet },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Landmark },
  { value: 'card', label: 'Card', icon: CreditCard }
];

export default function EditAppointmentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientLabel, setPatientLabel] = useState('');

  const [doctorId, setDoctorId] = useState<number | ''>('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [department, setDepartment] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [bookedTimes, setBookedTimes] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);

  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === doctorId) || null, [doctors, doctorId]);

  useEffect(() => {
    async function load() {
      try {
        const [apptData, doctorsData] = await Promise.all([
          api.get(`/api/appointments/${id}`),
          api.get('/api/doctors')
        ]);
        const a = apptData.appointment;
        setDoctors((doctorsData.doctors || []).filter((d: Doctor) => d.active || d.id === a.doctor_id));
        setPatientLabel(`${a.patient_name} (${a.patient_phone})`);
        setDoctorId(a.doctor_id);
        setAppointmentDate(a.appointment_date);
        setAppointmentTime(a.appointment_time);
        setDepartment(a.department || '');
        setReason(a.reason || '');
        setNotes(a.notes || '');
        setPaymentMethod(a.payment_method);
        setAmount(a.amount);
        setDiscount(a.discount);
        setPaidAmount(a.paid_amount);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!doctorId || !appointmentDate) {
      setBookedTimes(new Set());
      return;
    }
    let active = true;
    setLoadingSlots(true);
    api
      .get(`/api/appointments?doctor_id=${doctorId}&date=${appointmentDate}`)
      .then((data) => {
        if (!active) return;
        const taken = (data.appointments || [])
          .filter((a: any) => a.status !== 'cancelled' && String(a.id) !== String(id))
          .map((a: any) => a.appointment_time);
        setBookedTimes(new Set(taken));
      })
      .catch(() => { if (active) setBookedTimes(new Set()); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [doctorId, appointmentDate, id]);

  const netPayable = Math.max(amount - discount, 0);
  const paymentStatus = paidAmount >= netPayable && netPayable > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/api/appointments/${id}`, {
        doctor_id: doctorId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        department,
        reason,
        notes,
        payment_method: paymentMethod,
        amount,
        discount,
        paid_amount: paidAmount
      });
      router.push(`/dashboard/appointments/${id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => router.push(`/dashboard/appointments/${id}`)}
        className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5"
      >
        <ArrowLeft size={15} /> Back to appointment
      </button>

      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Edit Appointment</h1>
        <p className="text-sm text-gray-500 mt-1">Patient: {patientLabel}</p>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Doctor &amp; Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="kmc-label">Doctor</label>
              <select className="kmc-input" value={doctorId} onChange={(e) => setDoctorId(Number(e.target.value))}>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialization}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="kmc-label">Appointment Date</label>
              <input type="date" className="kmc-input" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="kmc-label">Appointment Time</label>
              {!selectedDoctor ? (
                <p className="text-xs text-gray-400">Select a doctor to see available time slots.</p>
              ) : loadingSlots ? (
                <p className="text-xs text-gray-400">Loading slots...</p>
              ) : selectedDoctor.slots.length === 0 ? (
                <p className="text-xs text-crimson-600">
                  This doctor has no time slots configured. Add slots on the Doctors page, or keep the existing time below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedDoctor.slots.map((t) => {
                    const taken = bookedTimes.has(t);
                    const active = appointmentTime === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={taken}
                        onClick={() => setAppointmentTime(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          taken
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                            : active
                            ? 'border-navy-700 bg-navy-700 text-white'
                            : 'border-gray-200 text-gray-700 hover:bg-mist'
                        }`}
                      >
                        {formatSlot(t)}
                      </button>
                    );
                  })}
                </div>
              )}
              {(!selectedDoctor || selectedDoctor.slots.length === 0) && (
                <input type="time" className="kmc-input mt-2" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} />
              )}
            </div>
            <div>
              <label className="kmc-label">Department</label>
              <input className="kmc-input" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="kmc-label">Reason for Visit</label>
              <input className="kmc-input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="kmc-label">Internal Notes</label>
              <textarea className="kmc-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Payment</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors ${
                  paymentMethod === m.value ? 'border-crimson-500 bg-crimson-50 text-crimson-700' : 'border-gray-200 text-gray-600 hover:bg-mist'
                }`}
              >
                <m.icon size={18} />
                {m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="kmc-label">Fee Amount (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <label className="kmc-label">Discount (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div>
              <label className="kmc-label">Paid Amount (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value))} />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between bg-mist rounded-xl px-4 py-3">
            <div className="text-sm text-gray-600">
              Net Payable: <span className="font-mono-num font-semibold text-navy-900">Rs. {netPayable.toLocaleString()}</span>
            </div>
            <span
              className={`kmc-badge ${
                paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : paymentStatus === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'
              }`}
            >
              {paymentStatus}
            </span>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push(`/dashboard/appointments/${id}`)} className="kmc-btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="kmc-btn-accent">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
