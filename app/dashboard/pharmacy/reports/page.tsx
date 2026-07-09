'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingCart, RotateCcw, FileText, AlertTriangle, Truck, ClipboardList,
  Undo2, Wallet, Package, BarChart3, Pill, Printer,
} from 'lucide-react';

import SalesSection from './_sections/SalesSection';
import ReturnsSection from './_sections/ReturnsSection';
import PrescriptionsSection from './_sections/PrescriptionsSection';
import BatchExpirySection from './_sections/BatchExpirySection';
import SuppliersSection from './_sections/SuppliersSection';
import PurchaseOrdersSection from './_sections/PurchaseOrdersSection';
import PurchaseReturnsSection from './_sections/PurchaseReturnsSection';
import CustomerCreditSection from './_sections/CustomerCreditSection';
import StockManagementSection from './_sections/StockManagementSection';
import StockSection from './_sections/StockSection';
import MedicinesSection from './_sections/MedicinesSection';

function todayStr() { return new Date().toISOString().slice(0,10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }

const TABS = [
  { key: 'sales', label: 'Sales', icon: ShoppingCart, Component: SalesSection },
  { key: 'returns', label: 'Returns', icon: RotateCcw, Component: ReturnsSection },
  { key: 'prescriptions', label: 'Prescriptions', icon: FileText, Component: PrescriptionsSection },
  { key: 'batch-expiry', label: 'Batch Expiry', icon: AlertTriangle, Component: BatchExpirySection },
  { key: 'suppliers', label: 'Suppliers', icon: Truck, Component: SuppliersSection },
  { key: 'purchase-orders', label: 'Purchase Orders', icon: ClipboardList, Component: PurchaseOrdersSection },
  { key: 'purchase-returns', label: 'Purchase Returns', icon: Undo2, Component: PurchaseReturnsSection },
  { key: 'customer-credit', label: 'Customer Credit', icon: Wallet, Component: CustomerCreditSection },
  { key: 'stock-management', label: 'Stock Management', icon: Package, Component: StockManagementSection },
  { key: 'stock', label: 'Stock', icon: BarChart3, Component: StockSection },
  { key: 'medicines', label: 'Medicines', icon: Pill, Component: MedicinesSection },
] as const;

export default function PharmacyReportsPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-16">Loading...</div>}>
      <PharmacyReportsInner/>
    </Suspense>
  );
}

function PharmacyReportsInner() {
  const router = useRouter();
  const search = useSearchParams();

  const activeKey = TABS.some(t => t.key === search.get('type')) ? (search.get('type') as string) : 'sales';
  const from = search.get('from') || daysAgo(6);
  const to = search.get('to') || todayStr();

  function updateParams(next: Record<string, string>) {
    const sp = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(next)) sp.set(k, v);
    router.replace(`/dashboard/pharmacy/reports?${sp.toString()}`);
  }

  const active = TABS.find(t => t.key === activeKey) || TABS[0];
  const ActiveComponent = active.Component;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Pharmacy Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Filter by report type and date range across the whole pharmacy module.</p>
        </div>
        <button onClick={() => window.print()} className="kmc-btn-ghost flex items-center gap-2 text-sm">
          <Printer size={15}/> Print
        </button>
      </div>

      {/* Report type tabs */}
      <div className="kmc-card p-2 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {TABS.map(t => (
            <button key={t.key} onClick={() => updateParams({ type: t.key })}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                activeKey === t.key ? 'bg-navy-900 text-white' : 'text-gray-600 hover:bg-mist'
              }`}>
              <t.icon size={14}/> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shared date range */}
      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <input type="date" className="kmc-input max-w-[160px]" value={from} onChange={e => updateParams({ from: e.target.value })}/>
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" className="kmc-input max-w-[160px]" value={to} onChange={e => updateParams({ to: e.target.value })}/>
        <div className="flex gap-2 ml-auto">
          {[['Today',0],['7 Days',6],['30 Days',29]].map(([l,n]) => (
            <button key={l} onClick={() => updateParams({ from: daysAgo(n as number), to: todayStr() })}
              className="kmc-btn-ghost text-xs px-3 py-1.5">{l}</button>
          ))}
        </div>
      </div>

      <ActiveComponent from={from} to={to}/>
    </div>
  );
}
