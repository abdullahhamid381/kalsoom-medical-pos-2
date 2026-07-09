'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

const PAY_LABELS: Record<string, string> = {
  cash: 'Cash',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
  bank_transfer: 'Bank Transfer',
  card: 'Card'
};

export default function PrintReceiptPage() {
  const params = useParams();
  const id = params.id as string;

  const [appt, setAppt] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [error, setError] = useState('');
  const [barcodeLoaded, setBarcodeLoaded] = useState(false);
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    Promise.all([api.get(`/api/appointments/${id}`), api.get('/api/clinic')])
      .then(([apptData, clinicData]) => {
        setAppt(apptData.appointment);
        setClinic(clinicData);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (appt && clinic && barcodeLoaded && !printed) {
      setPrinted(true);
      setTimeout(() => window.print(), 150);
    }
  }, [appt, clinic, barcodeLoaded, printed]);

  if (error) {
    return <div style={{ padding: 24, color: '#b91c1c', fontFamily: 'sans-serif' }}>{error}</div>;
  }
  if (!appt || !clinic) {
    return <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#666' }}>Loading receipt...</div>;
  }

  const netPayable = appt.amount - appt.discount;

  return (
    <>
      <style>{`
        @page { size: 80mm auto; margin: 3mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <div className="no-print" style={{ padding: 16, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <button
          onClick={() => window.print()}
          style={{
            background: '#13244a',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Print Receipt
        </button>
        <p style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
          This is a compact receipt sized for small/thermal paper - it won't fill a full page.
        </p>
      </div>

      <div
        style={{
          width: '80mm',
          maxWidth: '80mm',
          margin: '0 auto',
          padding: '6mm',
          fontFamily: "'Courier New', monospace",
          fontSize: 11,
          color: '#111',
          lineHeight: 1.45
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{clinic.name.toUpperCase()}</div>
          <div style={{ fontSize: 9.5 }}>{clinic.address}</div>
          <div style={{ fontSize: 9.5 }}>{clinic.phone}</div>
        </div>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12 }}>APPOINTMENT SLIP</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span>No: {appt.appointment_no}</span>
          <span style={{ fontWeight: 700 }}>Token #{appt.token_number}</span>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div><strong>Patient:</strong> {appt.patient_name}</div>
        <div><strong>Phone:</strong> {appt.patient_phone}</div>
        {appt.patient_age || appt.patient_gender ? (
          <div>
            <strong>Age/Gender:</strong> {appt.patient_age || '-'} / {appt.patient_gender}
          </div>
        ) : null}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div><strong>Doctor:</strong> {appt.doctor_name}</div>
        <div><strong>Dept:</strong> {appt.department || appt.doctor_department}</div>
        <div><strong>Date:</strong> {appt.appointment_date}</div>
        <div><strong>Time:</strong> {appt.appointment_time}</div>
        {appt.reason && <div><strong>Reason:</strong> {appt.reason}</div>}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Method</span>
          <span>{PAY_LABELS[appt.payment_method] || appt.payment_method}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Fee</span>
          <span>Rs. {appt.amount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Discount</span>
          <span>Rs. {appt.discount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Net Payable</span>
          <span>Rs. {netPayable}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <span>Paid ({appt.payment_status.toUpperCase()})</span>
          <span>Rs. {appt.paid_amount}</span>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div style={{ textAlign: 'center', margin: '6px 0' }}>
          <img
            src={`/api/appointments/${id}/barcode`}
            alt="barcode"
            style={{ maxWidth: '100%', height: 42 }}
            onLoad={() => setBarcodeLoaded(true)}
            onError={() => setBarcodeLoaded(true)}
          />
        </div>

        <div style={{ textAlign: 'center', fontSize: 9, color: '#444' }}>
          Please arrive 15 minutes early. Booked by {appt.booked_by_name}.
        </div>
      </div>
    </>
  );
}
