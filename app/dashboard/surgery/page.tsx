'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scissors, Plus, Wallet, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api-client';

function todayStr() { return new Date().toISOString().slice(0,10); }
const STATUS_COLORS: Record<string,string> = { scheduled:'bg-amber-100 text-amber-800', completed:'bg-emerald-100 text-emerald-800', cancelled:'bg-gray-200 text-gray-600' };

export default function SurgeryPage() {
  const [report, setReport] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const date = todayStr();
    Promise.all([
      api.get(`/api/surgery/reports?from=${date}&to=${date}`),
      api.get(`/api/surgery/records?from=${date}&to=${date}`)
    ]).then(([r,s]) => { setReport(r); setRecords((s.records||[]).slice(0,8)); })
    .catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2"><Scissors size={22} className="text-purple-600"/>Surgery</h1>
          <p className="text-sm text-gray-500 mt-1">Operation theatre records, surgeon fees and surgery reports.</p>
        </div>
        <Link href="/dashboard/surgery/records/new" className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>New Surgery</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:"Today's Surgeries", value: report?.totals?.total_surgeries??0, icon: Scissors, tint:'bg-purple-50 text-purple-700' },
          { label:"Today's Collected", value:`Rs.${Number(report?.totals?.total_collected??0).toLocaleString()}`, icon: Wallet, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Scheduled', value: report?.totals?.scheduled??0, icon: Clock, tint:'bg-amber-50 text-amber-700' },
          { label:'Completed', value: report?.totals?.completed??0, icon: CheckCircle2, tint:'bg-emerald-50 text-emerald-700' },
        ].map(c=>(
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading?'—':c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-navy-900">Today's Surgery Records</h2>
          <Link href="/dashboard/surgery/records" className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">View all <ArrowRight size={13}/></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
              {['Surgery No','Patient','Surgery','Surgeon','Total','Paid','Status'].map(h=><th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
              {!loading && records.length===0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No surgeries today.</td></tr>}
              {records.map((r:any)=>(
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer" onClick={()=>window.location.href=`/dashboard/surgery/records/${r.id}`}>
                  <td className="px-5 py-3 font-mono-num text-navy-800">{r.surgery_no}</td>
                  <td className="px-5 py-3 font-medium text-navy-900">{r.patient_name}<br/><span className="text-xs text-gray-400 font-mono-num">{r.patient_phone}</span></td>
                  <td className="px-5 py-3 text-gray-700">{r.surgery_name}<br/><span className="text-xs text-gray-400">{r.surgery_category}</span></td>
                  <td className="px-5 py-3 text-gray-600">{r.surgeon_name?`Dr.${r.surgeon_name}`:'—'}</td>
                  <td className="px-5 py-3 font-mono-num font-semibold">Rs.{r.total_cost}</td>
                  <td className="px-5 py-3 font-mono-num text-gray-600">Rs.{r.paid_amount}</td>
                  <td className="px-5 py-3"><span className={`kmc-badge ${STATUS_COLORS[r.status]||''}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
