'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Wallet, ShoppingCart, AlertTriangle, ArrowRight, Plus } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function PharmacyPage() {
  const session = useSession();
  const isSuperAdmin = session?.role === 'super_admin';
  const [report, setReport] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const date = todayStr();
    Promise.all([
      api.get(`/api/pharmacy/reports?from=${date}&to=${date}`),
      api.get(`/api/pharmacy/sales?date=${date}`)
    ]).then(([r, s]) => {
      setReport(r);
      setSales((s.sales || []).slice(0, 8));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const lowStock: any[] = report?.lowStock || [];
  const expiredBatches: any[] = report?.expiredBatches || [];
  const nearExpiryBatches: any[] = report?.nearExpiryBatches || [];

  const cards = [
    { label: "Today's Sales", value: report?.totals?.total_sales ?? 0, icon: ShoppingCart, tint: 'bg-sky-50 text-sky-700' },
    { label: "Today's Collection", value: `Rs. ${Number(report?.totals?.total_collected ?? 0).toLocaleString()}`, icon: Wallet, tint: 'bg-emerald-50 text-emerald-700' },
    { label: 'Low Stock Alerts', value: lowStock.length, icon: AlertTriangle, tint: lowStock.length > 0 ? 'bg-crimson-50 text-crimson-700' : 'bg-gray-50 text-gray-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2">
            <FlaskConical size={22} className="text-sky-600" /> Pharmacy
          </h1>
          <p className="text-sm text-gray-500 mt-1">Medicine sales, stock management and daily collection.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/pharmacy/sales/new" className="kmc-btn-accent flex items-center gap-2">
            <Plus size={16} /> New Sale
          </Link>
          {isSuperAdmin && (
            <Link href="/dashboard/pharmacy/medicines" className="kmc-btn-primary flex items-center gap-2">
              <FlaskConical size={16} /> Medicines
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="kmc-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.tint}`}>
              <c.icon size={18} />
            </div>
            <p className="text-2xl font-display font-bold text-navy-900 mt-3">{loading ? '—' : c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="kmc-card p-4 border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={15} /> Low Stock Warning
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((m: any) => (
              <span key={m.id} className="kmc-badge bg-amber-100 text-amber-800">
                {m.name} — {m.stock_qty} {m.unit} left
              </span>
            ))}
          </div>
        </div>
      )}

      {(expiredBatches.length > 0 || nearExpiryBatches.length > 0) && (
        <div className="kmc-card p-4 border-crimson-200 bg-crimson-50">
          <p className="text-sm font-semibold text-crimson-800 flex items-center gap-1.5 mb-2">
            <AlertTriangle size={15} /> Expiring / Expired Stock
          </p>
          <div className="flex flex-wrap gap-2">
            {expiredBatches.map((b: any) => (
              <span key={`exp-${b.id}`} className="kmc-badge bg-crimson-100 text-crimson-800">
                {b.medicine_name} (batch {b.batch_no}) — expired {b.expiry_date}
              </span>
            ))}
            {nearExpiryBatches.map((b: any) => (
              <span key={`near-${b.id}`} className="kmc-badge bg-amber-100 text-amber-800">
                {b.medicine_name} (batch {b.batch_no}) — expires {b.expiry_date}
              </span>
            ))}
          </div>
          <Link href="/dashboard/pharmacy/batches" className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1 mt-2">
            View batches <ArrowRight size={13} />
          </Link>
        </div>
      )}

      <div className="kmc-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-navy-900">Today's Sales</h2>
          <Link href="/dashboard/pharmacy/sales" className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1">
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-semibold">Sale No.</th>
                <th className="px-5 py-3 font-semibold">Patient</th>
                <th className="px-5 py-3 font-semibold">Total</th>
                <th className="px-5 py-3 font-semibold">Paid</th>
                <th className="px-5 py-3 font-semibold">Method</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-5 py-6 text-center text-gray-400">Loading...</td></tr>}
              {!loading && sales.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No sales recorded today.</td></tr>
              )}
              {sales.map((s: any) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                  onClick={() => window.location.href = `/dashboard/pharmacy/sales/${s.id}`}>
                  <td className="px-5 py-3 font-mono-num text-navy-800">{s.sale_no}</td>
                  <td className="px-5 py-3 font-medium text-navy-900">{s.patient_name}</td>
                  <td className="px-5 py-3 font-mono-num font-semibold">Rs. {s.total}</td>
                  <td className="px-5 py-3 font-mono-num text-gray-600">Rs. {s.paid_amount}</td>
                  <td className="px-5 py-3 text-gray-500 capitalize">{s.payment_method.replace('_',' ')}</td>
                  <td className="px-5 py-3">
                    <span className={`kmc-badge ${s.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : s.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'}`}>
                      {s.payment_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
