'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

const STATUS_STYLES: Record<string, string> = {
  assigned: 'bg-sky-100 text-sky-800', collected: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-gray-200 text-gray-600'
};

export default function HomeCollectionsPage() {
  const session = useSession();
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get(`/api/lab/home-collections${statusFilter ? `?status=${statusFilter}` : ''}`);
      setCollections(d.collections || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [statusFilter]);

  async function assignToMe(id: number) {
    setBusyId(id);
    try { await api.put(`/api/lab/home-collections/${id}`, { collector_user_id: session?.id }); await load(); }
    finally { setBusyId(null); }
  }
  async function markCollected(id: number) {
    setBusyId(id);
    try { await api.put(`/api/lab/home-collections/${id}`, { status: 'collected' }); await load(); }
    finally { setBusyId(null); }
  }
  async function cancel(id: number) {
    if (!confirm('Cancel this home collection?')) return;
    setBusyId(id);
    try { await api.put(`/api/lab/home-collections/${id}`, { status: 'cancelled' }); await load(); }
    finally { setBusyId(null); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2"><Home size={22} className="text-sky-600"/> Home Collections</h1>
          <p className="text-sm text-gray-500 mt-1">Rider worklist for at-home sample pickups.</p>
        </div>
        <select className="kmc-input max-w-[180px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="assigned">Assigned</option>
          <option value="collected">Collected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Order No', 'Patient', 'Address', 'Scheduled', 'Collector', 'Priority', 'Status', 'Actions'].map(h => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && collections.length === 0 && <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">No home collections.</td></tr>}
            {collections.map((c: any) => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3"><Link href={`/dashboard/lab/orders/${c.order_id}`} className="font-mono-num text-navy-800 hover:underline">{c.order_no}</Link></td>
                <td className="px-5 py-3 font-medium text-navy-900">{c.patient_name}<div className="text-xs text-gray-400 font-mono-num">{c.patient_phone}</div></td>
                <td className="px-5 py-3 text-gray-600 max-w-[220px] truncate">{c.address || '—'}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString('en-PK') : '—'}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{c.collector_name || '—'}</td>
                <td className="px-5 py-3"><span className="kmc-badge bg-gray-100 text-gray-600">{c.priority}</span></td>
                <td className="px-5 py-3"><span className={`kmc-badge ${STATUS_STYLES[c.status] || ''}`}>{c.status}</span></td>
                <td className="px-5 py-3">
                  {c.status === 'assigned' && (
                    <div className="flex gap-2">
                      {!c.collector_user_id && <button disabled={busyId === c.id} onClick={() => assignToMe(c.id)} className="kmc-btn-ghost text-xs px-3 py-1.5">Assign to me</button>}
                      <button disabled={busyId === c.id} onClick={() => markCollected(c.id)} className="kmc-btn-primary text-xs px-3 py-1.5">Mark Collected</button>
                      <button disabled={busyId === c.id} onClick={() => cancel(c.id)} className="text-xs text-gray-400 hover:text-crimson-600">Cancel</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
