'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';

const PAY_LABELS: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };

export default function PrintLabReceiptPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<any>(null);
  const [clinic, setClinic] = useState<any>(null);
  const [barcodeLoaded, setBarcodeLoaded] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get(`/api/lab/orders/${id}`), api.get('/api/clinic')])
      .then(([o, c]) => { setOrder(o.order); setClinic(c); })
      .catch(e => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (order && clinic && barcodeLoaded && !printed) { setPrinted(true); setTimeout(() => window.print(), 150); }
  }, [order, clinic, barcodeLoaded, printed]);

  if (error) return <div style={{ padding: 24, color: '#b91c1c', fontFamily: 'sans-serif' }}>{error}</div>;
  if (!order || !clinic) return <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#666' }}>Loading receipt...</div>;

  return (
    <>
      <style>{`
        @page { size: 80mm auto; margin: 3mm; }
        @media print { .no-print { display: none !important; } html,body { background:#fff; } }
        * { box-sizing: border-box; } body { margin: 0; }
      `}</style>

      <div className="no-print" style={{ padding:16, textAlign:'center', fontFamily:'sans-serif' }}>
        <button onClick={() => window.print()}
          style={{ background:'#13244a', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontWeight:600, cursor:'pointer' }}>
          Print Receipt
        </button>
        <p style={{ color:'#888', fontSize:12, marginTop:8 }}>Compact thermal receipt for 80mm printer.</p>
      </div>

      <div style={{ width:'80mm', maxWidth:'80mm', margin:'0 auto', padding:'6mm', fontFamily:"'Courier New', monospace", fontSize:11, color:'#111', lineHeight:1.45 }}>
        <div style={{ textAlign:'center', marginBottom:6 }}>
          <div style={{ fontWeight:700, fontSize:13 }}>{clinic.name.toUpperCase()}</div>
          <div style={{ fontSize:9.5 }}>LABORATORY</div>
          <div style={{ fontSize:9.5 }}>{clinic.address}</div>
          <div style={{ fontSize:9.5 }}>{clinic.phone}</div>
        </div>
        <div style={{ borderTop:'1px dashed #000', margin:'5px 0' }}/>

        <div style={{ textAlign:'center', fontWeight:700 }}>LAB ORDER RECEIPT</div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
          <span>{order.order_no}</span>
          <span>{new Date(order.created_at).toLocaleDateString('en-PK')}</span>
        </div>
        <div style={{ borderTop:'1px dashed #000', margin:'5px 0' }}/>

        <div><strong>Patient:</strong> {order.patient_name}</div>
        {order.patient_phone && <div><strong>Phone:</strong> {order.patient_phone}</div>}
        {(order.patient_age || order.patient_gender) && (
          <div><strong>Age/Gender:</strong> {order.patient_age || '—'} / {order.patient_gender || '—'}</div>
        )}
        {order.referring_doctor && <div><strong>Referred by:</strong> Dr. {order.referring_doctor}</div>}
        <div style={{ borderTop:'1px dashed #000', margin:'5px 0' }}/>

        <div style={{ fontWeight:700, marginBottom:3 }}>TESTS:</div>
        {(order.items || []).map((item: any) => (
          <div key={item.id} style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ maxWidth:'60%' }}>{item.test_name}</span>
            <span>Rs. {item.price}</span>
          </div>
        ))}
        <div style={{ borderTop:'1px dashed #000', margin:'5px 0' }}/>

        {order.discount > 0 && <div style={{ display:'flex', justifyContent:'space-between' }}><span>Discount</span><span>Rs. {order.discount}</span></div>}
        <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700 }}><span>TOTAL</span><span>Rs. {order.total}</span></div>
        <div style={{ display:'flex', justifyContent:'space-between' }}><span>Paid ({PAY_LABELS[order.payment_method]})</span><span>Rs. {order.paid_amount}</span></div>
        {order.total - order.paid_amount > 0 && (
          <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700 }}><span>Balance Due</span><span>Rs. {order.total - order.paid_amount}</span></div>
        )}
        <div style={{ textAlign:'center', marginTop:5 }}>
          <span className={`kmc-badge`} style={{ fontFamily:'sans-serif', fontSize:9, padding:'2px 6px', borderRadius:4, background: order.payment_status === 'paid' ? '#d1fae5' : '#fef3c7', color: order.payment_status === 'paid' ? '#065f46' : '#92400e' }}>
            {order.payment_status.toUpperCase()}
          </span>
        </div>
        <div style={{ borderTop:'1px dashed #000', margin:'5px 0' }}/>

        <div style={{ textAlign:'center', margin:'5px 0' }}>
          <img
            src={`/api/lab/orders/${id}/barcode`}
            alt="barcode"
            style={{ maxWidth:'100%', height:40 }}
            onLoad={() => setBarcodeLoaded(true)}
            onError={() => setBarcodeLoaded(true)}
          />
        </div>
        <div style={{ textAlign:'center', fontSize:9, color:'#555' }}>
          Status: {order.status.toUpperCase()} | Booked by: {order.booked_by_name}<br/>
          Collect reports with this receipt. Thank you!
        </div>
      </div>
    </>
  );
}
