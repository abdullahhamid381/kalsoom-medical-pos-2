'use client';
import { useEffect, useState } from 'react';
import { Download, AlertTriangle, PackageX, PackageCheck } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function statusOf(expiry: string): 'expired' | 'near' | 'healthy' {
  const days = (new Date(expiry).getTime() - new Date(todayStr()).getTime()) / 86400000;
  if (days < 0) return 'expired';
  if (days <= 30) return 'near';
  return 'healthy';
}

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['Medicine','Batch No','Expiry Date','Qty','Location','Status'];
  const csvRows = rows.map((b:any) => [b.medicine_name, b.batch_no, b.expiry_date, b.qty, b.location, statusOf(b.expiry_date)]);
  const csv = [headers,...csvRows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Batch-Expiry-Report-${from}-to-${to}.csv`; a.click();
}

export default function BatchExpirySection({ from, to }: { from: string; to: string }) {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/pharmacy/batches?from=${from}&to=${to}`)
      .then(d => { if (active) setBatches((d.batches || []).filter((b: any) => b.qty > 0)); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const expired = batches.filter(b => statusOf(b.expiry_date) === 'expired');
  const near = batches.filter(b => statusOf(b.expiry_date) === 'near');
  const qtyAtRisk = [...expired, ...near].reduce((s, b) => s + b.qty, 0);

  const filtered = statusFilter ? batches.filter(b => statusOf(b.expiry_date) === statusFilter) : batches;

  const byMonthMap = new Map<string, number>();
  for (const b of batches) {
    const m = b.expiry_date.slice(0, 7);
    byMonthMap.set(m, (byMonthMap.get(m) || 0) + 1);
  }
  const byMonthData = [...byMonthMap.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select className="kmc-input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="expired">Expired</option>
          <option value="near">Near Expiry (≤30 days)</option>
          <option value="healthy">Healthy</option>
        </select>
        <button onClick={() => exportCSV(filtered, from, to)} disabled={loading||!filtered.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label:'Batches Expiring in Range', value: batches.length, icon: PackageCheck, tint:'bg-navy-50 text-navy-700' },
          { label:'Expired', value: expired.length, icon: PackageX, tint: expired.length>0 ? 'bg-crimson-50 text-crimson-700' : 'bg-gray-50 text-gray-500' },
          { label:'Near Expiry (≤30d)', value: near.length, icon: AlertTriangle, tint: near.length>0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500' },
          { label:'Qty At Risk', value: qtyAtRisk, icon: AlertTriangle, tint: qtyAtRisk>0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={16}/></div>
            <p className="text-xl font-display font-bold text-navy-900 mt-2">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">Batches Expiring by Month</h2>
        {byMonthData.length === 0 ? <p className="text-sm text-gray-400">No batches expiring in this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byMonthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="month" tick={{ fontSize: 11 }}/>
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false}/>
              <Tooltip/>
              <Bar dataKey="count" fill="#f59e0b" name="Batches" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">Batches ({filtered.length})</h2>
          <button onClick={() => exportCSV(filtered, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
            {['Medicine','Batch No','Expiry','Qty','Location','Status'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No batches found.</td></tr>}
            {filtered.map((b: any) => {
              const status = statusOf(b.expiry_date);
              return (
                <tr key={b.id} className={`border-b border-gray-50 last:border-0 ${status==='expired' ? 'bg-crimson-50/40' : status==='near' ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-3 font-medium text-navy-900">{b.medicine_name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.batch_no}</td>
                  <td className="px-4 py-3 font-mono-num text-gray-600">{b.expiry_date}</td>
                  <td className="px-4 py-3 font-mono-num text-gray-700">{b.qty} {b.unit}</td>
                  <td className="px-4 py-3"><span className="kmc-badge bg-navy-50 text-navy-700 capitalize">{b.location}</span></td>
                  <td className="px-4 py-3">
                    <span className={`kmc-badge ${status==='expired' ? 'bg-crimson-100 text-crimson-800' : status==='near' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {status==='expired' ? 'Expired' : status==='near' ? 'Near Expiry' : 'Healthy'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
