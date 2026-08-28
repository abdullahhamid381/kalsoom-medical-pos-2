'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

export default function PrintPurchaseOrderPage() {
  const params = useParams();
  const id = params.id as string;
  const [po, setPo] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [printed, setPrinted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get(`/api/pharmacy/purchase-orders/${id}`), api.get('/api/clinic')])
      .then(([p, c]) => { setPo(p.purchaseOrder); setClinic(c); })
      .catch(e => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (po && clinic && !printed) { setPrinted(true); setTimeout(() => window.print(), 150); }
  }, [po, clinic, printed]);

  if (error) return <div style={{ padding: 24, color: '#b91c1c', fontFamily: 'sans-serif' }}>{error}</div>;
  if (!po || !clinic) return <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#666' }}>Loading purchase order...</div>;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 15mm; }
        @media print { .no-print { display: none !important; } html, body { background: #fff; } }
        * { box-sizing: border-box; } body { margin: 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 6px; text-align: left; border-bottom: 1px solid #e5e7eb; }
      `}</style>

      <div className="no-print" style={{ padding: 16, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <button onClick={() => window.print()}
          style={{ background: '#13244a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>
          Print Purchase Order
        </button>
      </div>

      <div style={{ maxWidth: '190mm', margin: '0 auto', padding: '8mm', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #13244a', paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#13244a' }}>{clinic.name}</div>
            <div style={{ fontSize: 11, color: '#555' }}>{clinic.address}</div>
            <div style={{ fontSize: 11, color: '#555' }}>{clinic.phone}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>PURCHASE ORDER</div>
            <div style={{ fontSize: 11 }}>{po.po_no}</div>
            <div style={{ fontSize: 11, color: '#555' }}>{new Date(po.created_at).toLocaleDateString('en-PK')}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Supplier</div>
            <div>{po.supplier_name}</div>
            {po.supplier_phone && <div>{po.supplier_phone}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Expected Delivery</div>
            <div>{po.expected_date || '—'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th>Medicine</th><th>Ordered Qty</th><th>Unit Price</th><th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(po.items || []).map((item: any) => (
              <tr key={item.id}>
                <td>{item.medicine_name}</td>
                <td>{item.ordered_qty}</td>
                <td>Rs. {item.unit_price}</td>
                <td style={{ textAlign: 'right' }}>Rs. {item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16, marginLeft: 'auto', width: 220 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Subtotal</span><span>Rs. {po.subtotal}</span></div>
          {po.discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Discount</span><span>Rs. {po.discount}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 700, borderTop: '1px solid #111' }}><span>Total</span><span>Rs. {po.total}</span></div>
        </div>

        {po.notes && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Notes</div>
            <div>{po.notes}</div>
          </div>
        )}

        <div style={{ marginTop: 40, fontSize: 11, color: '#555' }}>
          Raised by {po.created_by_name}
        </div>

        <div style={{ marginTop: 24, borderTop: '1px dashed #ccc', paddingTop: 8, textAlign: 'center', fontSize: 9, color: '#9aa6ba' }}>
          System powered by Krexen Technologies · www.krexen.com
        </div>
      </div>
    </>
  );
}
