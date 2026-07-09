'use client';
import { useEffect, useState } from 'react';
import { Download, ClipboardList, Banknote, PackageCheck, Clock } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b'];
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700', ordered: 'bg-sky-100 text-sky-800',
  partially_received: 'bg-amber-100 text-amber-800', received: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-crimson-100 text-crimson-800',
};

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['PO No','Date','Supplier','Status','Total','Created By'];
  const csvRows = rows.map((po:any) => [po.po_no, new Date(po.created_at).toLocaleString('en-PK'), po.supplier_name, po.status, po.total, po.created_by_name]);
  const csv = [headers,...csvRows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Purchase-Order-Report-${from}-to-${to}.csv`; a.click();
}

export default function PurchaseOrdersSection({ from, to }: { from: string; to: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get('/api/pharmacy/suppliers').then(d => setSuppliers(d.suppliers || [])).catch(() => {}); }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const sp = new URLSearchParams({ from, to });
    if (status) sp.set('status', status);
    if (supplierId) sp.set('supplier_id', supplierId);
    api.get(`/api/pharmacy/purchase-orders?${sp}`)
      .then(d => { if (active) setOrders(d.purchaseOrders || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, status, supplierId]);

  const totalValue = orders.reduce((s, po) => s + po.total, 0);
  const receivedCount = orders.filter(po => po.status === 'received').length;
  const pendingCount = orders.filter(po => ['draft','ordered','partially_received'].includes(po.status)).length;

  const byStatusMap = new Map<string, number>();
  for (const po of orders) byStatusMap.set(po.status, (byStatusMap.get(po.status) || 0) + 1);
  const byStatusData = [...byStatusMap.entries()].map(([name, count]) => ({ name: name.replace('_',' '), count }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          <select className="kmc-input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="ordered">Ordered</option>
            <option value="partially_received">Partially Received</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select className="kmc-input w-auto" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">All Suppliers</option>
            {suppliers.map((s:any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={() => exportCSV(orders, from, to)} disabled={loading||!orders.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label:'Total Orders', value: orders.length, icon: ClipboardList, tint:'bg-navy-50 text-navy-700' },
          { label:'Total Value', value:`Rs. ${totalValue.toLocaleString()}`, icon: Banknote, tint:'bg-sky-50 text-sky-700' },
          { label:'Received', value: receivedCount, icon: PackageCheck, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Pending', value: pendingCount, icon: Clock, tint: pendingCount>0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={16}/></div>
            <p className="text-xl font-display font-bold text-navy-900 mt-2">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">By Status</h2>
        {byStatusData.length === 0 ? <p className="text-sm text-gray-400">No purchase orders in this range.</p> : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byStatusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis type="number" tick={{fontSize:11}} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={110}/>
              <Tooltip/>
              <Bar dataKey="count" name="Orders" radius={[0,4,4,0]}>
                {byStatusData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">All Purchase Orders ({orders.length})</h2>
          <button onClick={() => exportCSV(orders, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
            {['PO No','Date','Supplier','Total','Status','Created By'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && orders.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No purchase orders found.</td></tr>}
            {orders.map((po: any) => (
              <tr key={po.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                onClick={() => window.open(`/dashboard/pharmacy/purchase-orders/${po.id}`, '_blank')}>
                <td className="px-4 py-3 font-mono-num text-navy-800 whitespace-nowrap">{po.po_no}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(po.created_at).toLocaleString('en-PK')}</td>
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
