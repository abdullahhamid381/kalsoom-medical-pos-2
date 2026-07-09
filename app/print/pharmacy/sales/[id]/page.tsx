'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

const PAY_LABELS: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };

export default function PrintPharmacyReceiptPage() {
  const params = useParams();
  const id = params.id as string;
  const [sale, setSale] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [printed, setPrinted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get(`/api/pharmacy/sales/${id}`), api.get('/api/clinic')])
      .then(([s, c]) => { setSale(s.sale); setClinic(c); })
      .catch(e => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (sale && clinic && !printed) { setPrinted(true); setTimeout(() => window.print(), 150); }
  }, [sale, clinic, printed]);

  if (error) return <div style={{ padding: 24, color: '#b91c1c', fontFamily: 'sans-serif' }}>{error}</div>;
  if (!sale || !clinic) return <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#666' }}>Loading receipt...</div>;

  return (
    <>
      <style>{`
        @page { size: 80mm auto; margin: 3mm; }
        @media print { .no-print { display: none !important; } html, body { background: #fff; } }
        * { box-sizing: border-box; } body { margin: 0; }
      `}</style>

      <div className="no-print" style={{ padding: 16, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <button onClick={() => window.print()}
          style={{ background: '#13244a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>
          Print Receipt
        </button>
        <p style={{ color: '#888', fontSize: 12, marginTop: 8 }}>Compact receipt for small/thermal printers.</p>
      </div>

      <div style={{ width: '80mm', maxWidth: '80mm', margin: '0 auto', padding: '6mm', fontFamily: "'Courier New', monospace", fontSize: 11, color: '#111', lineHeight: 1.45 }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{clinic.name.toUpperCase()}</div>
          <div style={{ fontSize: 9.5 }}>PHARMACY</div>
          <div style={{ fontSize: 9.5 }}>{clinic.address}</div>
          <div style={{ fontSize: 9.5 }}>{clinic.phone}</div>
        </div>
        <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}/>

        <div style={{ textAlign: 'center', fontWeight: 700 }}>SALE RECEIPT</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span>{sale.sale_no}</span>
          <span>{new Date(sale.created_at).toLocaleDateString('en-PK')}</span>
        </div>
        <div><strong>Patient:</strong> {sale.patient_name}</div>
        {sale.patient_phone && <div><strong>Phone:</strong> {sale.patient_phone}</div>}

        <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}/>

        {(sale.items || []).map((item: any) => (
          <div key={item.id}>
            <div style={{ fontWeight: 600 }}>{item.medicine_name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 8, fontSize: 10 }}>
              <span>{item.qty} {item.unit} × Rs. {item.unit_price}</span>
              <span>Rs. {item.total}</span>
            </div>
          </div>
        ))}

        <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}/>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>Rs. {sale.subtotal}</span></div>
        {sale.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>Rs. {sale.discount}</span></div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>TOTAL</span><span>Rs. {sale.total}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paid ({PAY_LABELS[sale.payment_method]})</span><span>Rs. {sale.paid_amount}</span></div>
        {sale.total - sale.paid_amount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>Balance Due</span><span>Rs. {sale.total - sale.paid_amount}</span></div>
        )}
        <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }}/>
        <div style={{ textAlign: 'center', fontSize: 9, color: '#444' }}>
          Status: {sale.payment_status.toUpperCase()} | Served by {sale.sold_by_name}<br/>
          Thank you for visiting {clinic.name}!
        </div>
      </div>
    </>
  );
}
