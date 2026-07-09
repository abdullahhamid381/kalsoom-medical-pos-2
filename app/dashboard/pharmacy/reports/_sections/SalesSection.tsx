'use client';
import { useEffect, useState } from 'react';
import { Download, Wallet, ShoppingCart, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api-client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PAY_LABELS: Record<string,string> = { cash:'Cash', jazzcash:'JazzCash', easypaisa:'EasyPaisa', bank_transfer:'Bank Transfer', card:'Card' };
const COLORS = ['#13244a','#d62828','#0ea5e9','#10b981','#f59e0b'];

function exportCSV(sales: any[], from: string, to: string) {
  if (!sales.length) return;
  const headers = ['Sale No','Date','Patient','Phone','Subtotal','Discount','Total','Paid','Balance','Pay Status','Method','Sold By'];
  const rows = sales.map((s:any) => [
    s.sale_no, new Date(s.created_at).toLocaleString('en-PK'), s.patient_name, s.patient_phone||'',
    s.subtotal, s.discount, s.total, s.paid_amount, s.total-s.paid_amount,
    s.payment_status, PAY_LABELS[s.payment_method]||s.payment_method, s.sold_by_name
  ]);
  const csv = [headers,...rows].map(r=>r.map((v:any)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = `Sales-Report-${from}-to-${to}.csv`; a.click();
}

export default function SalesSection({ from, to }: { from: string; to: string }) {
  const [report, setReport] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get(`/api/pharmacy/reports?from=${from}&to=${to}`),
      api.get(`/api/pharmacy/sales?from=${from}&to=${to}`)
    ]).then(([r, s]) => { if (active) { setReport(r); setSales(s.sales||[]); } })
    .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const byDayData = (report?.byDay||[]).map((r:any) => ({ date: r.date.slice(5), sales: r.count, collected: r.collected }));
  const byPayData = (report?.byPaymentMethod||[]).map((r:any) => ({ name: PAY_LABELS[r.payment_method]||r.payment_method, collected: r.collected, count: r.count }));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => exportCSV(sales, from, to)} disabled={loading||!sales.length} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Download size={15}/> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Total Sales', value: report?.totals?.total_sales??0, icon: ShoppingCart, tint:'bg-sky-50 text-sky-700' },
          { label:'Total Collected', value:`Rs. ${Number(report?.totals?.total_collected??0).toLocaleString()}`, icon: Wallet, tint:'bg-emerald-50 text-emerald-700' },
          { label:'Outstanding', value:`Rs. ${Math.max(Number(report?.totals?.total_billed??0)-Number(report?.totals?.total_collected??0),0).toLocaleString()}`, icon: TrendingDown, tint:'bg-crimson-50 text-crimson-700' }
        ].map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}><c.icon size={18}/></div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="kmc-card p-5">
        <h2 className="font-display font-semibold text-navy-900 mb-4">Daily Sales</h2>
        {byDayData.length === 0 ? <p className="text-sm text-gray-400">No data for this range.</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="date" tick={{ fontSize: 11 }}/>
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} allowDecimals={false}/>
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }}/>
              <Tooltip formatter={(v:any, n:string) => n==='collected' ? `Rs. ${Number(v).toLocaleString()}` : v}/>
              <Bar yAxisId="l" dataKey="sales" fill="#13244a" name="Sales" radius={[4,4,0,0]}/>
              <Bar yAxisId="r" dataKey="collected" fill="#d62828" name="Collected (Rs.)" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">By Payment Method</h2>
          {byPayData.length === 0 ? <p className="text-sm text-gray-400">No data.</p> : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={byPayData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis type="number" tick={{fontSize:11}}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:11}} width={90}/>
                <Tooltip formatter={(v:any) => `Rs. ${Number(v).toLocaleString()}`}/>
                <Bar dataKey="collected" name="Collected" radius={[0,4,4,0]}>
                  {byPayData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="kmc-card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-display font-semibold text-navy-900">Top Medicines by Revenue</h2>
          </div>
          <div className="p-5 space-y-2">
            {(report?.topMedicines||[]).length === 0 && <p className="text-sm text-gray-400">No data.</p>}
            {(report?.topMedicines||[]).map((m:any, i:number) => (
              <div key={m.medicine_name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{background: COLORS[i%COLORS.length]}}>{i+1}</span>
                  {m.medicine_name}
                </span>
                <span className="text-gray-500 text-xs">{m.total_qty} sold — <span className="font-mono-num font-semibold text-navy-900">Rs. {Number(m.total_revenue).toLocaleString()}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(report?.lowStock||[]).length > 0 && (
        <div className="kmc-card">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 rounded-t-2xl">
            <h2 className="font-display font-semibold text-amber-800">Low Stock Alert</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                {['Medicine','Category','Unit','Current Stock','Alert Level'].map(h=><th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {report.lowStock.map((m:any) => (
                  <tr key={m.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-2.5 font-medium text-navy-900">{m.name}</td>
                    <td className="px-5 py-2.5 text-gray-500 text-xs">{m.category||'—'}</td>
                    <td className="px-5 py-2.5 text-gray-500">{m.unit}</td>
                    <td className="px-5 py-2.5 font-mono-num font-bold text-amber-600">{m.stock_qty}</td>
                    <td className="px-5 py-2.5 font-mono-num text-gray-400">{m.low_stock_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="kmc-card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-semibold text-navy-900">All Sales Detail ({sales.length})</h2>
          <button onClick={() => exportCSV(sales, from, to)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            <Download size={13}/> CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
              {['Sale No','Date','Patient','Phone','Total','Paid','Balance','Status','Method','By'].map(h=>
                <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>}
              {!loading && sales.length===0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No sales in this range.</td></tr>}
              {sales.map((s:any) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                  onClick={() => window.open(`/dashboard/pharmacy/sales/${s.id}`,'_blank')}>
                  <td className="px-4 py-2.5 font-mono-num text-navy-800">{s.sale_no}</td>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(s.created_at).toLocaleString('en-PK')}</td>
                  <td className="px-4 py-2.5 font-medium text-navy-900">{s.patient_name}</td>
                  <td className="px-4 py-2.5 font-mono-num text-gray-400">{s.patient_phone||'—'}</td>
                  <td className="px-4 py-2.5 font-mono-num font-semibold text-navy-900">Rs. {s.total}</td>
                  <td className="px-4 py-2.5 font-mono-num text-emerald-700">Rs. {s.paid_amount}</td>
                  <td className="px-4 py-2.5 font-mono-num text-crimson-600">Rs. {s.total-s.paid_amount}</td>
                  <td className="px-4 py-2.5"><span className={`kmc-badge ${s.payment_status==='paid'?'bg-emerald-100 text-emerald-800':s.payment_status==='partial'?'bg-amber-100 text-amber-800':'bg-crimson-100 text-crimson-800'}`}>{s.payment_status}</span></td>
                  <td className="px-4 py-2.5 text-gray-500 capitalize">{s.payment_method.replace('_',' ')}</td>
                  <td className="px-4 py-2.5 text-gray-400">{s.sold_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
