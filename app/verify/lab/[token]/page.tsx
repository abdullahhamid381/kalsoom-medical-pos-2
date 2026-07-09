'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function VerifyLabReportPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/verify/lab/${token}`)
      .then(r => r.json())
      .then(d => setData(d.data))
      .catch(() => setData({ verified: false }))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f5f7fb', padding: 24 }}>
      <div style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center' }}>
        {loading ? (
          <p style={{ color: '#888' }}>Checking report...</p>
        ) : data?.verified ? (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>&#10003;</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#065f46', margin: 0 }}>Verified — Authentic Report</h1>
            <div style={{ marginTop: 20, textAlign: 'left', fontSize: 14, color: '#374151', lineHeight: 1.8 }}>
              <div><strong>Report No:</strong> {data.order_no}</div>
              <div><strong>Patient:</strong> {data.patient_name}</div>
              <div><strong>Report Date:</strong> {new Date(data.report_date).toLocaleString('en-PK')}</div>
              <div><strong>Signed By:</strong> {data.signed_by || '—'}</div>
            </div>
          </>
        ) : (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>&#10007;</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#b91c1c', margin: 0 }}>Not Verified</h1>
            <p style={{ marginTop: 12, fontSize: 14, color: '#6b7280' }}>This link is invalid or the report has not been finalized.</p>
          </>
        )}
      </div>
    </div>
  );
}
