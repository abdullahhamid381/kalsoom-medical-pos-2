'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Plus } from 'lucide-react';
import { api } from '@/lib/api-client';

function todayStr() { return new Date().toISOString().slice(0,10); }
function daysAgo(n:number) { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
const STATUS_COLORS: Record<string,string> = { scheduled:'bg-amber-100 text-amber-800', completed:'bg-emerald-100 text-emerald-800', cancelled:'bg-gray-200 text-gray-600' };

export default function SurgeryRecordsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(todayStr());
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true; setLoading(true);
    const p = new URLSearchParams();
    if (from) p.set('from',from); if (to) p.set('to',to);
    if (q.trim()) p.set('q',q.trim()); if (status) p.set('status',status);
    api.get(`/api/surgery/records?${p}`).then(d=>{ if(active) setRecords(d.records||[]); }).catch(()=>{}).finally(()=>{ if(active) setLoading(false); });
    return ()=>{ active=false; };
  }, [from,to,q,status]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold text-navy-900">Surgery Records</h1></div>
        <Link href="/dashboard/surgery/records/new" className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>New Surgery</Link>
      </div>
      <div className="kmc-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="kmc-input pl-9" placeholder="Search patient, phone, surgery no..." value={q} onChange={e=>setQ(e.target.value)}/></div>
        <input type="date" className="kmc-input" value={from} onChange={e=>setFrom(e.target.value)}/>
        <input type="date" className="kmc-input" value={to} onChange={e=>setTo(e.target.value)}/>
        <select className="kmc-input" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">All Status</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
        <div className="flex gap-1">{[['Today',0],['7d',6],['30d',29]].map(([l,n])=>(<button key={l} onClick={()=>{setFrom(daysAgo(n as number));setTo(todayStr());}} className="kmc-btn-ghost text-xs px-2 py-1.5">{l}</button>))}</div>
      </div>
      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
            {['Surgery No','Date','Patient','Surgery','Surgeon','Total','Paid','Balance','Pay','Status'].map(h=><th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={10} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && records.length===0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-gray-400">No records found.</td></tr>}
            {records.map((r:any)=>(
              <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer" onClick={()=>window.location.href=`/dashboard/surgery/records/${r.id}`}>
                <td className="px-4 py-3 font-mono-num text-navy-800">{r.surgery_no}</td>
                <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{r.surgery_date}</td>
                <td className="px-4 py-3 font-medium text-navy-900">{r.patient_name}</td>
                <td className="px-4 py-3 text-gray-700">{r.surgery_name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.surgeon_name?`Dr.${r.surgeon_name}`:'—'}</td>
                <td className="px-4 py-3 font-mono-num font-semibold text-navy-900">Rs.{r.total_cost}</td>
                <td className="px-4 py-3 font-mono-num text-emerald-700">Rs.{r.paid_amount}</td>
                <td className="px-4 py-3 font-mono-num text-crimson-600">Rs.{Math.max(r.total_cost-r.discount-r.paid_amount,0)}</td>
                <td className="px-4 py-3"><span className={`kmc-badge ${r.payment_status==='paid'?'bg-emerald-100 text-emerald-800':r.payment_status==='partial'?'bg-amber-100 text-amber-800':'bg-crimson-100 text-crimson-800'}`}>{r.payment_status}</span></td>
                <td className="px-4 py-3"><span className={`kmc-badge ${STATUS_COLORS[r.status]||''}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
