'use client';
import { useEffect, useState } from 'react';
import { Download, FileText, Users } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function exportCSV(rows: any[], from: string, to: string) {
  if (!rows.length) return;
  const headers = ['File','Patient','Phone','Doctor','Date'];
  const csvRows = rows.map((p:any) => [p.file_name, p.patient_name||'', p.patient_phone||'', p.doctor_name||'', new Date(p.created_at).toLocaleString('en-PK')]);
  const csv = [headers,...csvRows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Prescription-Report-${from}-to-${to}.csv`; a.click();
}

export default function PrescriptionsSection({ from, to }: { from: string; to: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`/api/pharmacy/prescriptions?from=${from}&to=${to}`)
      .then(d => { if (active) setRows(d.prescriptions || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const uniquePatients = new Set(rows.filter(r => r.patient_phone).map(r => r.patient_phone)).size;

  const byDayMap = new Map<string, number>();
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    byDayMap.set(d, (byDayMap.get(d) || 0) + 1);
  }
  const byDayData = [...byDayMap.entries()].sort((a,b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date: date.slice(5), count }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => exportCSV(rows, from, to)} disabled={loading||!rows.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label:'Prescriptions Uploaded', value: rows.length, icon: FileText, tint:'bg-navy-50 text-navy-700' },
          { label:'Unique Patients', value: uniquePatients, icon: Users, tint:'bg-sky-50 text-sky-700' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">Uploads by Day</h2>
        {byDayData.length === 0 ? <p className="text-sm text-gray-400">No prescriptions in this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="date" tick={{ fontSize: 11 }}/>
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false}/>
              <Tooltip/>
              <Bar dataKey="count" fill="#13244a" name="Prescriptions" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="kmc-card overflow-x-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">All Prescriptions ({rows.length})</h2>
          <button onClick={() => exportCSV(rows, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
            {['File','Patient','Phone','Doctor','Date'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No prescriptions in this range.</td></tr>}
            {rows.map((p: any) => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3">
                  <a href={`/api/pharmacy/prescriptions/${p.id}/file`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-medium text-navy-900 hover:text-crimson-600">
                    <FileText size={14}/> {p.file_name}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-700">{p.patient_name || '—'}</td>
                <td className="px-4 py-3 font-mono-num text-gray-500 text-xs">{p.patient_phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.doctor_name || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(p.created_at).toLocaleString('en-PK')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
