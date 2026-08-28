'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Smartphone, Landmark, CreditCard, Wallet, UserPlus, Search } from 'lucide-react';
import { api } from '@/lib/api-client';
import PatientSearch, { Patient } from '@/components/PatientSearch';
import { formatTime12h as formatSlot } from '@/lib/format';

type Doctor = {
  id: number;
  name: string;
  specialization: string;
  department: string;
  fee: number;
  active: number;
  slots: string[];
};

const PAYMENT_METHODS: { value: string; label: string; icon: any }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'jazzcash', label: 'JazzCash', icon: Smartphone },
  { value: 'easypaisa', label: 'EasyPaisa', icon: Wallet },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Landmark },
  { value: 'card', label: 'Card', icon: CreditCard }
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewAppointmentPage() {
  const router = useRouter();

  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [newPatient, setNewPatient] = useState({
    full_name: '',
    phone: '',
    cnic: '',
    age: '',
    gender: 'Other',
    address: ''
  });

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState<number | ''>('');
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  const [appointmentDate, setAppointmentDate] = useState(todayStr());
  const [appointmentTime, setAppointmentTime] = useState('');
  const [bookedTimes, setBookedTimes] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [department, setDepartment] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [touchedPaid, setTouchedPaid] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/doctors')
      .then((data) => setDoctors((data.doctors || []).filter((d: Doctor) => d.active)))
      .catch(() => setError('Could not load doctors list.'))
      .finally(() => setLoadingDoctors(false));
  }, []);

  const selectedDoctor = useMemo(() => doctors.find((d) => d.id === doctorId) || null, [doctors, doctorId]);

  useEffect(() => {
    if (selectedDoctor) {
      setAmount(selectedDoctor.fee);
      setDepartment(selectedDoctor.department);
    }
  }, [selectedDoctor]);

  useEffect(() => {
    setAppointmentTime('');
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
          .filter((a: any) => a.status !== 'cancelled')
          .map((a: any) => a.appointment_time);
        setBookedTimes(new Set(taken));
      })
      .catch(() => { if (active) setBookedTimes(new Set()); })
      .finally(() => { if (active) setLoadingSlots(false); });
    return () => { active = false; };
  }, [doctorId, appointmentDate]);

  useEffect(() => {
    if (!touchedPaid) setPaidAmount(Math.max(amount - discount, 0));
  }, [amount, discount, touchedPaid]);

  const netPayable = Math.max(amount - discount, 0);
  const paymentStatus = paidAmount >= netPayable && netPayable > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (patientMode === 'existing' && !selectedPatient) {
      setError('Please search and select a patient, or switch to "New Patient".');
      return;
    }
    if (patientMode === 'new' && (!newPatient.full_name.trim() || !newPatient.phone.trim())) {
      setError('Patient name and phone number are required.');
      return;
    }
    if (!doctorId) {
      setError('Please select a doctor.');
      return;
    }
    if (!appointmentDate || !appointmentTime) {
      setError('Please choose an appointment date and time.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
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
      };
      if (patientMode === 'existing') {
        payload.patient_id = selectedPatient!.id;
      } else {
        payload.newPatient = {
          ...newPatient,
          age: newPatient.age ? Number(newPatient.age) : null
        };
      }

      const data = await api.post('/api/appointments', payload);
      router.push(`/dashboard/appointments/${data.appointment.id}?new=1`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Book Appointment</h1>
        <p className="text-sm text-gray-500 mt-1">Create a new patient visit, assign a doctor and record payment.</p>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient section */}
        <section className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Patient</h2>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPatientMode('existing')}
                className={`px-3 py-1.5 flex items-center gap-1.5 ${
                  patientMode === 'existing' ? 'bg-navy-800 text-white' : 'bg-white text-gray-600'
                }`}
              >
                <Search size={13} /> Existing
              </button>
              <button
                type="button"
                onClick={() => {
                  setPatientMode('new');
                  setSelectedPatient(null);
                }}
                className={`px-3 py-1.5 flex items-center gap-1.5 ${
                  patientMode === 'new' ? 'bg-crimson-600 text-white' : 'bg-white text-gray-600'
                }`}
              >
                <UserPlus size={13} /> New Patient
              </button>
            </div>
          </div>

          {patientMode === 'existing' ? (
            <PatientSearch selected={selectedPatient} onSelect={setSelectedPatient} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="kmc-label">Full Name *</label>
                <input
                  className="kmc-input"
                  value={newPatient.full_name}
                  onChange={(e) => setNewPatient({ ...newPatient, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="kmc-label">Phone Number *</label>
                <input
                  className="kmc-input font-mono-num"
                  placeholder="03xx-xxxxxxx"
                  value={newPatient.phone}
                  onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="kmc-label">CNIC</label>
                <input
                  className="kmc-input font-mono-num"
                  placeholder="xxxxx-xxxxxxx-x"
                  value={newPatient.cnic}
                  onChange={(e) => setNewPatient({ ...newPatient, cnic: e.target.value })}
                />
              </div>
              <div>
                <label className="kmc-label">Age</label>
                <input
                  type="number"
                  min="0"
                  className="kmc-input"
                  value={newPatient.age}
                  onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                />
              </div>
              <div>
                <label className="kmc-label">Gender</label>
                <select
                  className="kmc-input"
                  value={newPatient.gender}
                  onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="kmc-label">Address</label>
                <input
                  className="kmc-input"
                  value={newPatient.address}
                  onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                />
              </div>
            </div>
          )}
        </section>

        {/* Doctor & schedule section */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Doctor &amp; Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="kmc-label">Doctor *</label>
              <select
                className="kmc-input"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : '')}
                required
              >
                <option value="">{loadingDoctors ? 'Loading doctors...' : 'Select a doctor'}</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.specialization} (Rs. {d.fee})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="kmc-label">Appointment Date *</label>
              <input
                type="date"
                className="kmc-input"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="kmc-label">Appointment Time *</label>
              {!selectedDoctor ? (
                <p className="text-xs text-gray-400">Select a doctor to see available time slots.</p>
              ) : loadingSlots ? (
                <p className="text-xs text-gray-400">Loading slots...</p>
              ) : selectedDoctor.slots.length === 0 ? (
                <p className="text-xs text-crimson-600">
                  This doctor has no time slots configured yet. Add slots on the Doctors page before booking.
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
            </div>
            <div>
              <label className="kmc-label">Department</label>
              <input className="kmc-input" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="kmc-label">Reason for Visit</label>
              <input
                className="kmc-input"
                placeholder="e.g. Fever and body ache, follow-up checkup..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="kmc-label">Internal Notes (optional)</label>
              <textarea
                className="kmc-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Payment section */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Payment</h2>

          <label className="kmc-label">Payment Method *</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPaymentMethod(m.value)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors ${
                  paymentMethod === m.value
                    ? 'border-crimson-500 bg-crimson-50 text-crimson-700'
                    : 'border-gray-200 text-gray-600 hover:bg-mist'
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
              <input
                type="number"
                min="0"
                className="kmc-input font-mono-num"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="kmc-label">Discount (Rs.)</label>
              <input
                type="number"
                min="0"
                className="kmc-input font-mono-num"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="kmc-label">Paid Amount (Rs.)</label>
              <input
                type="number"
                min="0"
                className="kmc-input font-mono-num"
                value={paidAmount}
                onChange={(e) => {
                  setTouchedPaid(true);
                  setPaidAmount(Number(e.target.value));
                }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between bg-mist rounded-xl px-4 py-3">
            <div className="text-sm text-gray-600">
              Net Payable: <span className="font-mono-num font-semibold text-navy-900">Rs. {netPayable.toLocaleString()}</span>
            </div>
            <span
              className={`kmc-badge ${
                paymentStatus === 'paid'
                  ? 'bg-emerald-100 text-emerald-800'
                  : paymentStatus === 'partial'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-crimson-100 text-crimson-800'
              }`}
            >
              {paymentStatus}
            </span>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <button type="submit" disabled={submitting} className="kmc-btn-accent">
            {submitting ? 'Booking...' : 'Confirm Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}
