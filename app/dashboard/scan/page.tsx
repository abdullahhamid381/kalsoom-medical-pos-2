'use client';

import { useEffect, useRef, useState } from 'react';
import { ScanLine, User, Stethoscope, CalendarDays, Clock, Wallet, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import StatusBadge from '@/components/StatusBadge';
import { formatTime12h } from '@/lib/format';

const FORWARD_STEPS: Record<string, { next: string; label: string } | undefined> = {
  pending: { next: 'confirmed', label: 'Confirm Arrival' },
  confirmed: { next: 'checked_in', label: 'Check In' },
  checked_in: { next: 'completed', label: 'Mark Checkup Complete' }
};

export default function ScanPatientPage() {
  const [code, setCode] = useState('');
  const [appt, setAppt] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setAppt(null);
    try {
      const data = await api.get(`/api/appointments/lookup?code=${encodeURIComponent(code.trim())}`);
      setAppt(data.appointment);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setCode('');
      inputRef.current?.focus();
    }
  }

  async function handleAdvance(nextStatus: string) {
    setUpdating(true);
    try {
      const data = await api.put(`/api/appointments/${appt.id}`, { status: nextStatus });
      setAppt(data.appointment);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  }

  function reset() {
    setAppt(null);
    setError('');
    inputRef.current?.focus();
  }

  const step = appt ? FORWARD_STEPS[appt.status] : undefined;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Scan Patient</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scan the barcode on the patient's slip with a USB/Bluetooth scanner, or type the appointment number below
          and press Enter.
        </p>
      </div>

      <form onSubmit={handleLookup} className="kmc-card p-5">
        <label className="kmc-label flex items-center gap-1.5">
          <ScanLine size={14} /> Appointment Number
        </label>
        <input
          ref={inputRef}
          className="kmc-input font-mono-num text-lg"
          placeholder="KMC-20260618-0001"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        <p className="text-xs text-gray-400 mt-2">
          Most barcode scanners type the code automatically and press Enter for you - just leave this box focused.
        </p>
      </form>

      {loading && <div className="kmc-card p-5 text-center text-gray-400 text-sm">Looking up appointment...</div>}
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {appt && (
        <div className="kmc-card overflow-hidden">
          <div className="bg-navy-900 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-display font-bold">{appt.appointment_no}</p>
              <p className="text-navy-200 text-xs mt-0.5">Token #{appt.token_number}</p>
            </div>
            <StatusBadge value={appt.status} />
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="kmc-label flex items-center gap-1.5">
                <User size={13} /> Patient
              </p>
              <p className="font-semibold text-navy-900">{appt.patient_name}</p>
              <p className="text-sm text-gray-500 font-mono-num">{appt.patient_phone}</p>
            </div>
            <div>
              <p className="kmc-label flex items-center gap-1.5">
                <Stethoscope size={13} /> Doctor
              </p>
              <p className="font-semibold text-navy-900">{appt.doctor_name}</p>
              <p className="text-sm text-gray-500">{appt.specialization}</p>
            </div>
            <div>
              <p className="kmc-label flex items-center gap-1.5">
                <CalendarDays size={13} /> Date / Time
              </p>
              <p className="text-sm text-gray-700">
                {appt.appointment_date} <span className="font-mono-num">{formatTime12h(appt.appointment_time)}</span>
              </p>
            </div>
            <div>
              <p className="kmc-label flex items-center gap-1.5">
                <Wallet size={13} /> Payment
              </p>
              <StatusBadge value={appt.payment_status} />
            </div>
          </div>

          <div className="px-6 pb-6 flex flex-wrap gap-3">
            {step && (
              <button onClick={() => handleAdvance(step.next)} disabled={updating} className="kmc-btn-accent flex items-center gap-2">
                <CheckCircle2 size={16} /> {updating ? 'Updating...' : step.label}
              </button>
            )}
            {appt.status === 'completed' && (
              <p className="text-sm text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Checkup already marked complete.
              </p>
            )}
            <button onClick={reset} className="kmc-btn-ghost">
              Scan Next Patient
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
