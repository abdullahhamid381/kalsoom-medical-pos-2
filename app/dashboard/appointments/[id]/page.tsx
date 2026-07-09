'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Download,
  Printer,
  MessageCircle,
  ArrowLeft,
  Stethoscope,
  User,
  Phone,
  CalendarDays,
  Clock,
  Wallet,
  Pencil,
  Trash2
} from 'lucide-react';import { api } from '@/lib/api-client';
import StatusBadge from '@/components/StatusBadge';
import { useSession } from '@/lib/session-context';
import { printThermal, appointmentReceiptHtml } from '@/lib/thermal-print';

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'same-origin' });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const STATUSES = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'];

const PAY_LABELS: Record<string, string> = {
  cash: 'Cash',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
  bank_transfer: 'Bank Transfer',
  card: 'Card'
};

export default function AppointmentDetailPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-16">Loading appointment...</div>}>
      <AppointmentDetailInner />
    </Suspense>
  );
}

function AppointmentDetailInner() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const id = params.id as string;
  const isNew = search.get('new') === '1';

  const [appt, setAppt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isDoctor = session?.role === 'doctor';
  const isSuperAdmin = session?.role === 'super_admin';
  const canEdit = session?.role === 'super_admin' || session?.role === 'receptionist';
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    if (!appt) return;
    setPrinting(true);
    try {
      // Fetch barcode as base64 data URL so the iframe can render it offline
      const barcodeUrl = await fetchAsDataUrl(`/api/appointments/${id}/barcode`);
      const clinic = await api.get('/api/clinic');
      printThermal(appointmentReceiptHtml(appt, clinic, barcodeUrl));
    } catch { /* print without barcode on error */ 
      const clinic = await api.get('/api/clinic').catch(() => ({ name: 'Clinic', address: '', phone: '' }));
      printThermal(appointmentReceiptHtml(appt, clinic));
    } finally {
      setPrinting(false);
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/api/appointments/${id}`);
      setAppt(data.appointment);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true);
    try {
      const data = await api.put(`/api/appointments/${id}`, { status: newStatus });
      setAppt(data.appointment);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleWhatsApp() {
    try {
      const res = await api.post(`/api/appointments/${id}/whatsapp`);
      if (res.shareLink) window.open(res.shareLink, '_blank');
    } catch (e: any) { setError(e.message); }
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this appointment? This cannot be undone. Consider cancelling instead if you just want to keep a record.')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/appointments/${id}`);
      router.push('/dashboard/appointments');
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="text-center text-gray-400 py-16">Loading appointment...</div>;
  }
  if (error && !appt) {
    return <div className="kmc-card p-5 border-crimson-200 bg-crimson-50 text-crimson-700">{error}</div>;
  }
  if (!appt) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard/appointments')}
          className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5"
        >
          <ArrowLeft size={15} /> Back to appointments
        </button>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/dashboard/appointments/${id}/edit`)}
              className="text-sm text-navy-700 hover:text-crimson-600 flex items-center gap-1.5 font-medium"
            >
              <Pencil size={14} /> Edit
            </button>
            {isSuperAdmin && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm text-gray-400 hover:text-crimson-600 flex items-center gap-1.5 font-medium"
              >
                <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        )}
      </div>

      {isNew && (
        <div className="kmc-card p-4 bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 size={18} /> Appointment booked successfully.
        </div>
      )}

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {/* Receipt card */}
      <div className="kmc-card overflow-hidden">
        <div className="bg-navy-900 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-lg">{appt.appointment_no}</p>
            <p className="text-navy-200 text-xs mt-0.5">Booked {new Date(appt.created_at).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono-num font-bold text-crimson-400">#{appt.token_number}</p>
            <p className="text-navy-200 text-[11px] uppercase tracking-wide">Token</p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="kmc-label flex items-center gap-1.5">
              <User size={13} /> Patient
            </p>
            <p className="font-semibold text-navy-900">{appt.patient_name}</p>
            <p className="text-sm text-gray-500 font-mono-num flex items-center gap-1.5 mt-0.5">
              <Phone size={12} /> {appt.patient_phone}
            </p>
            {appt.patient_cnic && <p className="text-xs text-gray-400 font-mono-num mt-0.5">CNIC: {appt.patient_cnic}</p>}
            {(appt.patient_age || appt.patient_gender) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {appt.patient_gender} {appt.patient_age ? `• ${appt.patient_age} yrs` : ''}
              </p>
            )}
          </div>

          <div>
            <p className="kmc-label flex items-center gap-1.5">
              <Stethoscope size={13} /> Doctor
            </p>
            <p className="font-semibold text-navy-900">{appt.doctor_name}</p>
            <p className="text-sm text-gray-500">{appt.specialization}</p>
            <p className="text-xs text-gray-400 mt-0.5">{appt.doctor_department}</p>
          </div>

          <div>
            <p className="kmc-label flex items-center gap-1.5">
              <CalendarDays size={13} /> Date &amp; Time
            </p>
            <p className="font-semibold text-navy-900">{appt.appointment_date}</p>
            <p className="text-sm text-gray-500 font-mono-num flex items-center gap-1.5 mt-0.5">
              <Clock size={12} /> {appt.appointment_time}
            </p>
          </div>

          {!isDoctor && (
            <div>
              <p className="kmc-label flex items-center gap-1.5">
                <Wallet size={13} /> Payment
              </p>
              <p className="text-sm text-gray-700">
                Method: <span className="font-medium text-navy-900">{PAY_LABELS[appt.payment_method]}</span>
              </p>
              <p className="text-sm text-gray-700 font-mono-num">
                Rs. {appt.paid_amount} / {appt.amount - appt.discount}{' '}
                <span className="ml-2">
                  <StatusBadge value={appt.payment_status} />
                </span>
              </p>
            </div>
          )}

          {appt.reason && (
            <div className="sm:col-span-2">
              <p className="kmc-label">Reason for Visit</p>
              <p className="text-sm text-gray-700">{appt.reason}</p>
            </div>
          )}

          <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-400">Booked by {appt.booked_by_name}</div>
            <StatusBadge value={appt.status} />
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col items-center">
          <img src={`/api/appointments/${id}/barcode`} alt="Appointment barcode" className="h-16" />
        </div>
      </div>

      {/* Actions */}
      <div className="kmc-card p-5 space-y-4">
        <h3 className="font-display font-semibold text-navy-900">Actions</h3>

        <div className="flex flex-wrap gap-3">
          <a href={`/api/appointments/${id}/pdf`} target="_blank" rel="noreferrer" className="kmc-btn-primary flex items-center gap-2">
            <Download size={16} /> Download PDF Slip
          </a>
          <button onClick={handlePrint} disabled={printing} className="kmc-btn-ghost flex items-center gap-2">
            <Printer size={16} /> {printing ? 'Preparing...' : 'Print Receipt'}
          </button>
          {!isDoctor && (
            <button onClick={handleWhatsApp} className="kmc-btn-accent flex items-center gap-2">
              <MessageCircle size={16} /> Send via WhatsApp
            </button>
          )}
        </div>

        <div>
          <p className="kmc-label">Update Status</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                disabled={updatingStatus}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  appt.status === s
                    ? 'bg-navy-800 text-white border-navy-800'
                    : 'border-gray-200 text-gray-600 hover:bg-mist'
                }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          {isDoctor && (
            <p className="text-xs text-gray-400 mt-2">
              Tip: use <span className="font-medium text-navy-700">Scan Patient</span> in the sidebar to update status by scanning the slip's barcode instead.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
