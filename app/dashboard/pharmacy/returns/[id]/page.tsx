'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api-client';

export default function ReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [ret, setRet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/pharmacy/returns/${id}`).then(d => setRet(d.return)).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>;
  if (!ret && error) return <div className="kmc-card p-5 border-crimson-200 bg-crimson-50 text-crimson-700">{error}</div>;
  if (!ret) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button onClick={() => router.push('/dashboard/pharmacy/returns')} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5">
        <ArrowLeft size={15}/> Back to returns
      </button>

      <div className="kmc-card overflow-hidden">
        <div className="bg-navy-900 text-white px-6 py-5 flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-lg">{ret.return_no}</p>
            <p className="text-navy-200 text-xs mt-0.5">{new Date(ret.created_at).toLocaleString('en-PK')}</p>
          </div>
          <span className="kmc-badge text-sm font-bold px-3 py-1.5 bg-navy-100 text-navy-800 capitalize">{ret.outcome.replace('_',' ')}</span>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="kmc-label">Original Sale</p>
            <a href={`/dashboard/pharmacy/sales/${ret.sale_id}`} className="font-semibold text-navy-900 hover:text-crimson-600 flex items-center gap-1">
              {ret.sale_no} <ExternalLink size={12}/>
            </a>
          </div>
          <div>
            <p className="kmc-label">Patient</p>
            <p className="font-semibold text-navy-900">{ret.patient_name}</p>
            {ret.patient_phone && <p className="text-gray-500 font-mono-num text-xs">{ret.patient_phone}</p>}
          </div>
        </div>

        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">Medicine</th><th className="px-5 py-3">Qty</th><th className="px-5 py-3">Unit Price</th><th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(ret.items || []).map((item: any) => (
                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-navy-900">{item.medicine_name}</td>
                  <td className="px-5 py-3 font-mono-num text-gray-700">{item.qty}</td>
                  <td className="px-5 py-3 font-mono-num text-gray-600">Rs. {item.unit_price}</td>
                  <td className="px-5 py-3 font-mono-num font-semibold text-navy-900 text-right">Rs. {item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 space-y-1 border-t border-gray-100 text-sm">
          {ret.reason && <div className="flex justify-between text-gray-500"><span>Reason</span><span>{ret.reason}</span></div>}
          <div className="flex justify-between font-bold text-navy-900 text-base"><span>Total</span><span className="font-mono-num">Rs. {ret.total}</span></div>
          {ret.refund_amount > 0 && <div className="flex justify-between text-crimson-700"><span>Refunded</span><span className="font-mono-num font-semibold">Rs. {ret.refund_amount}</span></div>}
          {ret.credit_amount > 0 && <div className="flex justify-between text-emerald-700"><span>Store Credit Issued</span><span className="font-mono-num font-semibold">Rs. {ret.credit_amount}</span></div>}
          <div className="text-xs text-gray-400 pt-1">Processed by {ret.created_by_name}</div>
        </div>
      </div>
    </div>
  );
}
