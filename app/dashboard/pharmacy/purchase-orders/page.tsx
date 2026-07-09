'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api-client';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  ordered: 'bg-sky-100 text-sky-800',
  partially_received: 'bg-amber-100 text-amber-800',
  received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-crimson-100 text-crimson-800',
};

export default function PurchaseOrdersListPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    api.get(`/api/pharmacy/purchase-orders?${params}`)
      .then(d => setOrders(d.purchaseOrders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Purchase Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Orders raised with suppliers and their receiving status.</p>
        </div>
        <Link href="/dashboard/pharmacy/purchase-orders/new" className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>New Purchase Order</Link>
      </div>

      <div className="kmc-card p-4">
        <select className="kmc-input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="ordered">Ordered</option>
          <option value="partially_received">Partially Received</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              {['PO No.','Date','Supplier','Total','Status','Created By'].map(h =>
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && orders.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No purchase orders found.</td></tr>}
            {orders.map((po: any) => (
              <tr key={po.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                onClick={() => window.location.href = `/dashboard/pharmacy/purchase-orders/${po.id}`}>
                <td className="px-4 py-3 font-mono-num text-navy-800 whitespace-nowrap">{po.po_no}</td>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{new Date(po.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-3 font-medium text-navy-900">{po.supplier_name}</td>
                <td className="px-4 py-3 font-mono-num font-semibold">Rs. {po.total}</td>
                <td className="px-4 py-3"><span className={`kmc-badge ${STATUS_COLORS[po.status]}`}>{po.status.replace('_',' ')}</span></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{po.created_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
