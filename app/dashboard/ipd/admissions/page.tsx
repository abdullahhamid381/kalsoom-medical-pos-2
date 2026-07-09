'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Plus } from 'lucide-react';
import { api } from '@/lib/api-client';

const STATUS_COLORS: Record<string,string> = { admitted:'bg-teal-100 text-teal-800', discharged:'bg-emerald-100 text-emerald-800', transferred:'bg-amber-100 text-amber-800' };
const TYPE_LABELS: Record<string,string> = { general:'General',ac:'AC',non_ac:'Non-AC',private:'Private',icu:'ICU',semi_private:'Semi-Private' };

export default function AdmissionsListPage() {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let active = true; setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get(`/api/ipd/admissions?${params}`)
      .then(d => { if (active) setAdmissions(d.admissions || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [q, status, from, to]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold text-navy-900">All Admissions</h1><p className="text-sm text-gray-500 mt-1">Search and manage all in-patient records.</p></div>
        <Link href="/dashboard/ipd/admissions/new" className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>Admit Patient</Link>
      </div>
      <div className="kmc-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="kmc-input pl-9" placeholder="Search patient, phone, admission no..." value={q} onChange={e=>setQ(e.target.value)}/></div>
        <select className="kmc-input" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="admitted">Currently Admitted</option>
          <option value="discharged">Discharged</option>
          <option value="transferred">Transferred</option>
        </select>
        <div className="flex gap-2">
          <input type="date" className="kmc-input flex-1" placeholder="From" value={from} onChange={e=>setFrom(e.target.value)}/>
          <input type="date" className="kmc-input flex-1" placeholder="To" value={to} onChange={e=>setTo(e.target.value)}/>
        </div>
      </div>
      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Adm. No','Patient','Room','Doctor','Admitted','Discharged','Days','Total','Paid','Status'].map(h=><th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && admissions.length===0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-gray-400">No admissions found.</td></tr>}
            {admissions.map((a:any)=>(
              <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer" onClick={()=>window.location.href=`/dashboard/ipd/admissions/${a.id}`}>
                <td className="px-4 py-3 font-mono-num text-navy-800">{a.admission_no}</td>
                <td className="px-4 py-3"><p className="font-medium text-navy-900">{a.patient_name}</p><p className="text-xs text-gray-400 font-mono-num">{a.patient_phone}</p></td>
                <td className="px-4 py-3"><p className="font-mono-num font-semibold text-navy-700">{a.room_no}</p><p className="text-xs text-gray-400">{TYPE_LABELS[a.room_type]||a.room_type}</p></td>
                <td className="px-4 py-3 text-gray-600 text-xs">{a.doctor_name ? `Dr. ${a.doctor_name}` : '—'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{a.admission_date}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{a.discharge_date||'—'}</td>
                <td className="px-4 py-3 font-mono-num text-navy-700">{a.days_stayed||'—'}</td>
                <td className="px-4 py-3 font-mono-num font-semibold text-navy-900">Rs. {a.grand_total}</td>
                <td className="px-4 py-3 font-mono-num text-emerald-700">Rs. {a.paid_amount}</td>
                <td className="px-4 py-3"><span className={`kmc-badge ${STATUS_COLORS[a.status]||''}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
