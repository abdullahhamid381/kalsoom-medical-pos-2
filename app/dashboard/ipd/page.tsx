'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BedDouble, Users, CheckCircle2, Wallet, ArrowRight, Plus, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api-client';

function todayStr() { return new Date().toISOString().slice(0, 10); }

const ROOM_TYPE_LABELS: Record<string,string> = {
  general:'General', ac:'AC Room', non_ac:'Non-AC', private:'Private', icu:'ICU', semi_private:'Semi-Private'
};
const ROOM_TYPE_COLORS: Record<string,string> = {
  general:'bg-gray-100 text-gray-700', ac:'bg-sky-100 text-sky-700', non_ac:'bg-amber-100 text-amber-700',
  private:'bg-purple-100 text-purple-700', icu:'bg-crimson-100 text-crimson-800', semi_private:'bg-indigo-100 text-indigo-700'
};

export default function IPDPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const date = todayStr();
    api.get(`/api/ipd/reports?from=2020-01-01&to=${date}`)
      .then(r => setReport(r)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const current: any[] = report?.currentlyAdmitted || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2">
            <BedDouble size={22} className="text-teal-600" /> IPD / Admissions
          </h1>
          <p className="text-sm text-gray-500 mt-1">In-patient department — room management, admissions, billing.</p>
        </div>
        <Link href="/dashboard/ipd/admissions/new" className="kmc-btn-accent flex items-center gap-2">
          <Plus size={16} /> Admit Patient
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Currently Admitted', value: report?.totals?.currently_admitted ?? 0, icon: BedDouble, tint:'bg-teal-50 text-teal-700' },
          { label:'Available Rooms', value: report?.availableRooms ?? 0, icon: CheckCircle2, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Occupied Rooms', value: report?.occupiedRooms ?? 0, icon: AlertCircle, tint:'bg-amber-50 text-amber-700' },
          { label:'Total Admitted (All Time)', value: report?.totals?.total_admissions ?? 0, icon: Users, tint:'bg-navy-50 text-navy-700' },
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Currently admitted */}
      <div className="kmc-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-navy-900">Currently Admitted Patients ({current.length})</h2>
          <Link href="/dashboard/ipd/admissions?status=admitted" className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            View all <ArrowRight size={13}/>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                {['Admission No','Patient','Room','Room Type','Doctor','Since','Days'].map(h =>
                  <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
              {!loading && current.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No patients currently admitted.</td></tr>}
              {current.map((a:any) => {
                const days = Math.ceil((Date.now() - new Date(a.admission_date).getTime()) / 86400000);
                return (
                  <tr key={a.admission_no} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                    onClick={() => window.location.href=`/dashboard/ipd/admissions?q=${a.admission_no}`}>
                    <td className="px-5 py-3 font-mono-num text-navy-800">{a.admission_no}</td>
                    <td className="px-5 py-3 font-medium text-navy-900">{a.patient_name}<br/><span className="text-xs text-gray-400 font-mono-num">{a.patient_phone}</span></td>
                    <td className="px-5 py-3 font-mono-num text-navy-700">{a.room_no}</td>
                    <td className="px-5 py-3"><span className={`kmc-badge ${ROOM_TYPE_COLORS[a.room_type]||'bg-gray-100 text-gray-600'}`}>{ROOM_TYPE_LABELS[a.room_type]||a.room_type}</span></td>
                    <td className="px-5 py-3 text-gray-600">{a.doctor_name ? `Dr. ${a.doctor_name}` : '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{a.admission_date}</td>
                    <td className="px-5 py-3 font-mono-num font-bold text-navy-700">{days}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
