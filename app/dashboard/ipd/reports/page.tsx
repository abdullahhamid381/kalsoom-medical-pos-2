'use client';
import { useEffect, useState } from 'react';
import { Download, Printer, BedDouble, Wallet, Users, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

const COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b','#8b5cf6'];
const TYPE_LABELS: Record<string,string> = { general:'General',ac:'AC Room',non_ac:'Non-AC',private:'Private',icu:'ICU',semi_private:'Semi-Private' };
const STATUS_COLORS: Record<string,string> = { available:'#10b981', occupied:'#d62828', maintenance:'#9ca3af' };

function exportCSV(admissions: any[], from: string, to: string) {
  if (!admissions.length) return;
  const headers = ['Admission No','Patient','Phone','Room','Room Type','Doctor','Admitted','Discharged','Days','Room Charges','Medicine','Lab','Procedure','Other','Grand Total','Discount','Paid','Balance','Payment Status','Status'];
  const rows = admissions.map((a:any) => [
    a.admission_no, a.patient_name, a.patient_phone||'', a.room_no, a.room_type,
    a.doctor_name||'', a.admission_date, a.discharge_date||'', a.days_stayed||'',
    a.room_charge_total, a.medicine_total, a.lab_total, a.procedure_total, a.other_total,
    a.grand_total, a.discount, a.paid_amount, a.grand_total - a.discount - a.paid_amount,
    a.payment_status, a.status
  ]);
  const csv = [headers,...rows].map(r=>r.map((v:any)=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `IPD-Report-${from}-to-${to}.csv`; a.click();
}

export default function IPDReportsPage() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(todayStr());
  const [report, setReport] = useState<any>(null);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true; setLoading(true);
    Promise.all([
      api.get(`/api/ipd/reports?from=${from}&to=${to}`),
      api.get(`/api/ipd/admissions?from=${from}&to=${to}`)
    ]).then(([r,a]) => { if (active) { setReport(r); setAdmissions(a.admissions||[]); } })
    .catch(()=>{}).finally(()=>{ if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const byDayData = (report?.byDay||[]).map((r:any)=>({ date: r.date.slice(5), admissions: r.admissions, collected: r.collected }));
  const byTypeData = (report?.byRoomType||[]).map((r:any)=>({ name: TYPE_LABELS[r.room_type]||r.room_type, count: r.count, revenue: r.revenue }));
  const roomStatusData = [
    { name:'Available', value: report?.availableRooms||0 },
    { name:'Occupied',  value: report?.occupiedRooms||0 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-display text-2xl font-bold text-navy-900">IPD Reports</h1><p className="text-sm text-gray-500 mt-1">Admissions, revenue and room occupancy analytics.</p></div>
        <div className="flex gap-2">
          <button onClick={()=>exportCSV(admissions,from,to)} disabled={loading||!admissions.length} className="kmc-btn-ghost flex items-center gap-2 text-sm"><Download size={15}/>Export CSV</button>
          <button onClick={()=>window.print()} className="kmc-btn-ghost flex items-center gap-2 text-sm"><Printer size={15}/>Print</button>
        </div>
      </div>

      {/* Date range */}
      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <input type="date" className="kmc-input max-w-[160px]" value={from} onChange={e=>setFrom(e.target.value)}/>
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" className="kmc-input max-w-[160px]" value={to} onChange={e=>setTo(e.target.value)}/>
        <div className="flex gap-2 ml-auto">
          {[['Today',0],['7 Days',6],['30 Days',29],['90 Days',89]].map(([l,n])=>(
            <button key={l} onClick={()=>{setFrom(daysAgo(n as number));setTo(todayStr());}} className="kmc-btn-ghost text-xs px-3 py-1.5">{l}</button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label:'Total Admissions', value: report?.totals?.total_admissions??0, icon: Users, tint:'bg-navy-50 text-navy-700' },
          { label:'Currently Admitted', value: report?.totals?.currently_admitted??0, icon: BedDouble, tint:'bg-teal-50 text-teal-700' },
          { label:'Total Collected', value:`Rs. ${Number(report?.totals?.total_collected??0).toLocaleString()}`, icon: Wallet, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Outstanding', value:`Rs. ${Math.max(Number(report?.totals?.total_outstanding??0),0).toLocaleString()}`, icon: TrendingDown, tint:'bg-crimson-50 text-crimson-700' },
        ].map(c=>(
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading?'—':c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily chart */}
        <div className="kmc-card p-5 lg:col-span-2">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Daily Admissions & Collection</h2>
          {byDayData.length===0 ? <p className="text-sm text-gray-400">No data for this range.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byDayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="date" tick={{fontSize:10}}/>
                <YAxis yAxisId="l" tick={{fontSize:10}} allowDecimals={false}/>
                <YAxis yAxisId="r" orientation="right" tick={{fontSize:10}}/>
                <Tooltip formatter={(v:any,n:string)=>n==='collected'?`Rs. ${Number(v).toLocaleString()}`:v}/>
                <Bar yAxisId="l" dataKey="admissions" fill="#13244a" name="Admissions" radius={[4,4,0,0]}/>
                <Bar yAxisId="r" dataKey="collected" fill="#d62828" name="Collected (Rs.)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        {/* Room status */}
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Room Status</h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={roomStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65}
                label={({name,value})=>`${name}: ${value}`} labelLine={false} fontSize={10}>
                <Cell fill="#10b981"/>
                <Cell fill="#d62828"/>
              </Pie>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* By room type */}
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">Revenue by Room Type</h2>
          {byTypeData.length===0 ? <p className="text-sm text-gray-400">No data.</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={byTypeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis type="number" tick={{fontSize:10}}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={80}/>
                <Tooltip formatter={(v:any)=>`Rs. ${Number(v).toLocaleString()}`}/>
                <Bar dataKey="revenue" name="Revenue" radius={[0,4,4,0]}>
                  {byTypeData.map((_:any,i:number)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Room occupancy table */}
        <div className="kmc-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-display font-semibold text-navy-900">Room Occupancy</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
                {['Room','Type','Price/Day','Status','Stays','Days','Revenue'].map(h=><th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {(report?.roomOccupancy||[]).map((r:any)=>(
                  <tr key={r.room_no} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5 font-mono-num font-bold text-navy-800">{r.room_no}</td>
                    <td className="px-4 py-2.5 text-gray-500">{TYPE_LABELS[r.room_type]||r.room_type}</td>
                    <td className="px-4 py-2.5 font-mono-num text-gray-600">Rs.{r.price_per_day}</td>
                    <td className="px-4 py-2.5"><span className="kmc-badge" style={{background:STATUS_COLORS[r.status]+'20',color:STATUS_COLORS[r.status]}}>{r.status}</span></td>
                    <td className="px-4 py-2.5 text-gray-600">{r.total_stays}</td>
                    <td className="px-4 py-2.5 font-mono-num text-gray-600">{r.total_days}</td>
                    <td className="px-4 py-2.5 font-mono-num font-semibold text-navy-900">Rs.{Number(r.revenue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Full admission table */}
      <div className="kmc-card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">All Admissions Detail ({admissions.length})</h2>
          <button onClick={()=>exportCSV(admissions,from,to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1"><Download size={13}/>CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
              {['Adm No','Patient','Room','Doctor','Admitted','Days','Total','Discount','Paid','Balance','Pay Status','Status'].map(h=><th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>}
              {!loading && admissions.length===0 && <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">No admissions in this range.</td></tr>}
              {admissions.map((a:any)=>(
                <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer" onClick={()=>window.open(`/dashboard/ipd/admissions/${a.id}`,'_blank')}>
                  <td className="px-4 py-2.5 font-mono-num text-navy-800">{a.admission_no}</td>
                  <td className="px-4 py-2.5 font-medium text-navy-900">{a.patient_name}</td>
                  <td className="px-4 py-2.5 font-mono-num">{a.room_no}</td>
                  <td className="px-4 py-2.5 text-gray-500">{a.doctor_name?`Dr.${a.doctor_name}`:'—'}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{a.admission_date}</td>
                  <td className="px-4 py-2.5 font-mono-num text-navy-700">{a.days_stayed||'—'}</td>
                  <td className="px-4 py-2.5 font-mono-num font-semibold text-navy-900">Rs.{a.grand_total}</td>
                  <td className="px-4 py-2.5 font-mono-num text-gray-400">Rs.{a.discount}</td>
                  <td className="px-4 py-2.5 font-mono-num text-emerald-700">Rs.{a.paid_amount}</td>
                  <td className="px-4 py-2.5 font-mono-num text-crimson-600">Rs.{Math.max(a.grand_total-a.discount-a.paid_amount,0)}</td>
                  <td className="px-4 py-2.5"><span className={`kmc-badge ${a.payment_status==='paid'?'bg-emerald-100 text-emerald-800':a.payment_status==='partial'?'bg-amber-100 text-amber-800':'bg-crimson-100 text-crimson-800'}`}>{a.payment_status}</span></td>
                  <td className="px-4 py-2.5"><span className={`kmc-badge ${a.status==='admitted'?'bg-teal-100 text-teal-800':a.status==='discharged'?'bg-gray-200 text-gray-600':'bg-amber-100 text-amber-800'}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
