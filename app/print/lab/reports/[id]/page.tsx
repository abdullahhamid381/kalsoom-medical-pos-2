'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

const FLAG_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  low: { bg: '#fef3c7', fg: '#92400e', label: 'LOW' },
  high: { bg: '#fef3c7', fg: '#92400e', label: 'HIGH' },
  critical: { bg: '#fee2e2', fg: '#b91c1c', label: 'CRITICAL' },
  normal: { bg: '#d1fae5', fg: '#065f46', label: 'NORMAL' }
};
const SIR_COLORS: Record<string, { bg: string; fg: string }> = {
  S: { bg: '#d1fae5', fg: '#065f46' }, I: { bg: '#fef3c7', fg: '#92400e' }, R: { bg: '#fee2e2', fg: '#b91c1c' }
};

function resultValue(item: any) {
  if (item.value_type === 'text') return item.value_text || '—';
  if (item.value_numeric == null) return '—';
  return `${item.value_numeric}${item.unit ? ' ' + item.unit : ''}`;
}

export default function PrintLabReportPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [clinic, setClinic] = useState<any>(null);
  const [barcodeLoaded, setBarcodeLoaded] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  useEffect(() => {
    Promise.all([api.get(`/api/lab/orders/${id}/report`), api.get('/api/clinic')])
      .then(([r, c]) => { setOrder(r.order); setItems(r.items || []); setClinic(c); })
      .catch(e => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (order && clinic && barcodeLoaded && qrLoaded && !printed) { setPrinted(true); setTimeout(() => window.print(), 150); }
  }, [order, clinic, barcodeLoaded, qrLoaded, printed]);

  async function handleWhatsApp() {
    setSending(true); setSendMsg('');
    try {
      const res = await api.post(`/api/lab/orders/${id}/report/whatsapp`);
      if (res.sent) setSendMsg('Report sent on WhatsApp.');
      else if (res.shareLink) { window.open(res.shareLink, '_blank'); setSendMsg('Opened WhatsApp share link (direct session not connected).'); }
    } catch (e: any) { setSendMsg(e.message); }
    finally { setSending(false); }
  }

  if (error) return <div style={{ padding: 24, color: '#b91c1c', fontFamily: 'sans-serif' }}>{error}</div>;
  if (!order || !clinic) return <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#666' }}>Loading report...</div>;

  let lastPanel: string | null | undefined;

  return (
    <>
      <style>{`
        @page { size: A5; margin: 8mm; }
        @media print { .no-print { display: none !important; } html,body { background:#fff; } }
        * { box-sizing: border-box; } body { margin: 0; font-family: 'Helvetica Neue', Arial, sans-serif; }
      `}</style>

      <div className="no-print" style={{ padding: 16, textAlign: 'center', fontFamily: 'sans-serif', display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => window.print()} style={{ background: '#13244a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>Print</button>
        <a href={`/api/lab/orders/${id}/report/pdf`} target="_blank" rel="noreferrer" style={{ background: '#d62828', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, textDecoration: 'none' }}>Download PDF</a>
        <button onClick={handleWhatsApp} disabled={sending} style={{ background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>
          {sending ? 'Sending...' : 'Send on WhatsApp'}
        </button>
        {sendMsg && <p style={{ width: '100%', color: '#475467', fontSize: 12 }}>{sendMsg}</p>}
      </div>

      <div style={{ width: '148mm', maxWidth: '148mm', margin: '0 auto', padding: '6mm', fontSize: 11, color: '#111' }}>
        <div style={{ background: '#13244a', color: '#fff', padding: '10px 14px', borderRadius: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{clinic.name.toUpperCase()}</div>
          <div style={{ fontSize: 9, color: '#cfd9ec' }}>{clinic.address}</div>
          <div style={{ fontSize: 9, color: '#cfd9ec' }}>{clinic.phone} | {clinic.email}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#ffd9d9', marginTop: 4 }}>LABORATORY REPORT</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '10px 0', fontSize: 10 }}>
          <span><strong>Report No:</strong> {order.order_no}</span>
          <span><strong>Date:</strong> {new Date(order.created_at).toLocaleDateString('en-PK')}</span>
        </div>
        <div style={{ fontSize: 10, marginBottom: 4 }}><strong>Patient:</strong> {order.patient_name} — {order.patient_age ?? '—'} yrs / {order.patient_gender || '—'}</div>
        {order.referring_doctor && <div style={{ fontSize: 10, marginBottom: 8 }}><strong>Referred by:</strong> Dr. {order.referring_doctor}</div>}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, marginTop: 8 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#475467', borderBottom: '1px solid #e3e7ef' }}>
              <th style={{ padding: '4px 6px' }}>Test</th>
              <th style={{ padding: '4px 6px' }}>Result</th>
              <th style={{ padding: '4px 6px' }}>Reference Range</th>
              <th style={{ padding: '4px 6px' }}>Flag</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const showPanel = item.panel_name && item.panel_name !== lastPanel;
              lastPanel = item.panel_name || undefined;
              const fc = item.flag ? FLAG_COLORS[item.flag] : null;

              if (item.culture) {
                return (
                  <React.Fragment key={i}>
                    {showPanel && (
                      <tr><td colSpan={4} style={{ padding: '6px 6px 2px', color: '#d62828', fontWeight: 700, fontSize: 8.5, textTransform: 'uppercase' }}>{item.panel_name}</td></tr>
                    )}
                    <tr><td colSpan={4} style={{ padding: '4px 6px 0', fontWeight: 600 }}>{item.test_name}</td></tr>
                    {item.culture.length === 0 && <tr><td colSpan={4} style={{ padding: '2px 6px 6px', color: '#6b7280' }}>No growth</td></tr>}
                    {item.culture.map((org: any, oi: number) => (
                      <React.Fragment key={oi}>
                        <tr><td colSpan={4} style={{ padding: '2px 6px', fontStyle: 'italic', color: '#13244a' }}>{org.organism}{org.growth_count ? ` (${org.growth_count})` : ''}</td></tr>
                        {org.sensitivities.map((s: any, si: number) => {
                          const sc = SIR_COLORS[s.result];
                          return (
                            <tr key={si}>
                              <td style={{ padding: '1px 6px 1px 18px' }}>{s.antibiotic}</td>
                              <td colSpan={3} style={{ padding: '1px 6px' }}>
                                <span style={{ background: sc.bg, color: sc.fg, borderRadius: 4, padding: '1px 6px', fontSize: 8, fontWeight: 700 }}>{s.result}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              }

              return (
                <React.Fragment key={i}>
                  {showPanel && (
                    <tr><td colSpan={4} style={{ padding: '6px 6px 2px', color: '#d62828', fontWeight: 700, fontSize: 8.5, textTransform: 'uppercase' }}>{item.panel_name}</td></tr>
                  )}
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '4px 6px', fontWeight: 600 }}>{item.test_name}</td>
                    <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{resultValue(item)}</td>
                    <td style={{ padding: '4px 6px', color: '#475467' }}>{item.reference_display || '—'}</td>
                    <td style={{ padding: '4px 6px' }}>
                      {fc && <span style={{ background: fc.bg, color: fc.fg, borderRadius: 4, padding: '2px 6px', fontSize: 8, fontWeight: 700 }}>{fc.label}</span>}
                    </td>
                  </tr>
                  {item.comment && (
                    <tr><td colSpan={4} style={{ padding: '0 6px 4px', color: '#6b7280', fontSize: 8.5 }}>Note: {item.comment}</td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <img
            src={`/api/lab/orders/${id}/barcode`}
            alt="barcode"
            style={{ height: 40 }}
            onLoad={() => setBarcodeLoaded(true)}
            onError={() => setBarcodeLoaded(true)}
          />
          <img
            src={`/api/lab/orders/${id}/report/qr`}
            alt="qr"
            style={{ height: 60, width: 60 }}
            onLoad={() => setQrLoaded(true)}
            onError={() => setQrLoaded(true)}
          />
        </div>

        <div style={{ borderTop: '1px solid #e3e7ef', marginTop: 12, paddingTop: 8, fontSize: 9 }}>
          <div style={{ fontWeight: 700 }}>Verified by: {order.reported_by_name || 'Pending verification'}</div>
          {order.reported_at && <div style={{ color: '#475467' }}>Reported on {new Date(order.reported_at).toLocaleString('en-PK')}</div>}
          <div style={{ color: '#9aa6ba', marginTop: 6, fontSize: 8 }}>Computer generated report. Results should be interpreted in correlation with clinical findings.</div>
          <div style={{ color: '#9aa6ba', marginTop: 4, fontSize: 8, textAlign: 'center' }}>System powered by Krexen Technologies · www.krexen.com</div>
        </div>
      </div>
    </>
  );
}
