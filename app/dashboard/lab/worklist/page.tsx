'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ListChecks } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

const PRIORITY_STYLES: Record<string, string> = {
  routine: 'bg-gray-100 text-gray-600', urgent: 'bg-amber-100 text-amber-800', stat: 'bg-crimson-100 text-crimson-800'
};

export default function LabWorklistPage() {
  const session = useSession();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try { const d = await api.get('/api/lab/worklist'); setGroups(d.groups || []); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function assignToMe(orderItemId: number) {
    setBusyId(orderItemId);
    try { await api.put('/api/lab/worklist/assign', { order_item_id: orderItemId, technician_id: session?.id }); await load(); }
    finally { setBusyId(null); }
  }
  async function unassign(orderItemId: number) {
    setBusyId(orderItemId);
    try { await api.put('/api/lab/worklist/assign', { order_item_id: orderItemId, technician_id: null }); await load(); }
    finally { setBusyId(null); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2"><ListChecks size={22} className="text-sky-600"/> Department Worklist</h1>
        <p className="text-sm text-gray-500 mt-1">Pending tests grouped by department, STAT and urgent orders first.</p>
      </div>

      {loading && <div className="kmc-card p-8 text-center text-gray-400">Loading...</div>}
      {!loading && groups.length === 0 && <div className="kmc-card p-8 text-center text-gray-400">No pending tests. Everything is caught up.</div>}

      {groups.map(group => (
        <div key={group.category} className="kmc-card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-mist/60">
            <h3 className="font-display font-semibold text-navy-900 text-sm">{group.category}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                {['Order No', 'Patient', 'Test', 'Priority', 'Assigned To', 'Action'].map(h => <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {group.items.map((item: any) => (
                <tr key={item.order_item_id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/lab/orders/${item.order_id}`} className="font-mono-num text-navy-800 hover:underline">{item.order_no}</Link>
                  </td>
                  <td className="px-5 py-3 font-medium text-navy-900">{item.patient_name}</td>
                  <td className="px-5 py-3 text-gray-600">{item.test_name}</td>
                  <td className="px-5 py-3"><span className={`kmc-badge ${PRIORITY_STYLES[item.priority] || ''}`}>{item.priority}</span></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{item.assigned_technician_name || '—'}</td>
                  <td className="px-5 py-3">
                    {item.assigned_technician_id ? (
                      <button disabled={busyId === item.order_item_id} onClick={() => unassign(item.order_item_id)} className="text-xs text-gray-400 hover:text-crimson-600">Unassign</button>
                    ) : (
                      <button disabled={busyId === item.order_item_id} onClick={() => assignToMe(item.order_item_id)} className="kmc-btn-ghost text-xs px-3 py-1.5">Assign to me</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
