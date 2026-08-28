'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard,
  CalendarPlus,
  CalendarClock,
  Users,
  Stethoscope,
  UserCog,
  BarChart3,
  Settings,
  ScanLine,
  FlaskConical,
  TestTube,
  BedDouble,
  Scissors,
  Stethoscope as Logo
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['super_admin', 'receptionist', 'receptionist_admin', 'doctor', 'pharmacy_admin', 'sales_person'] },
  { href: '/dashboard/appointments/new', label: 'Book Appointment', icon: CalendarPlus, roles: ['super_admin', 'receptionist', 'receptionist_admin'] },
  { href: '/dashboard/appointments', label: 'Appointments', icon: CalendarClock, roles: ['super_admin', 'receptionist', 'receptionist_admin', 'doctor'] },
  { href: '/dashboard/scan', label: 'Scan Patient', icon: ScanLine, roles: ['super_admin', 'receptionist', 'receptionist_admin', 'doctor'] },
  { href: '/dashboard/pharmacy', label: 'Pharmacy', icon: FlaskConical, roles: ['super_admin', 'receptionist', 'pharmacy_admin', 'sales_person'] },
  { href: '/dashboard/lab', label: 'Laboratory', icon: TestTube, roles: ['super_admin', 'receptionist', 'lab_technician', 'lab_senior_technologist', 'lab_pathologist'] },
  { href: '/dashboard/ipd', label: 'IPD / Admission', icon: BedDouble, roles: ['super_admin', 'receptionist', 'ward_admin'] },
  { href: '/dashboard/surgery', label: 'Surgery', icon: Scissors, roles: ['super_admin', 'receptionist', 'ward_admin'] },
  { href: '/dashboard/patients', label: 'Patients', icon: Users, roles: ['super_admin', 'receptionist', 'receptionist_admin'] },
  { href: '/dashboard/doctors', label: 'Doctors', icon: Stethoscope, roles: ['super_admin', 'receptionist_admin'] },
  { href: '/dashboard/users', label: 'Staff Users', icon: UserCog, roles: ['super_admin', 'receptionist_admin'] },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3, roles: ['super_admin', 'receptionist', 'receptionist_admin', 'doctor'] },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, roles: ['super_admin'] }
];

/** Picks the single most specific (longest) href that matches pathname, so a nested route like
 *  /dashboard/appointments/new only lights up "Book Appointment", not "Appointments" too. */
function bestMatchHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(href + '/');
    if (matches && (!best || href.length > best.length)) best = href;
  }
  return best;
}

export default function Sidebar({ user, clinicName }: { user: SessionUser | null; clinicName: string }) {
  const pathname = usePathname();
  const visibleNav = NAV.filter((item) => !user || item.roles.includes(user.role));
  const activeMainHref = bestMatchHref(pathname, visibleNav.map((i) => i.href));

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-navy-950 text-white min-h-screen sticky top-0">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy-500 to-crimson-600 flex items-center justify-center shrink-0">
          <Logo size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold text-sm leading-tight truncate">{clinicName}</p>
          <p className="text-navy-300 text-[11px]">Appointment Desk</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleNav.map((item) => {
          const active = item.href === activeMainHref;
          const Icon = item.icon;
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  active ? 'bg-white text-navy-900 shadow-sm' : 'text-navy-100 hover:bg-white/10'
                )}
              >
                <Icon size={17} className={active ? 'text-crimson-600' : 'text-navy-300'} />
                {item.label}
              </Link>
              {/* Pharmacy sub-nav */}
              {item.href === '/dashboard/pharmacy' && pathname.startsWith('/dashboard/pharmacy') && (() => {
                const subItems = [
                  { href: '/dashboard/pharmacy/sales', label: 'Sales', roles: ['super_admin','pharmacy_admin','sales_person'] },
                  { href: '/dashboard/pharmacy/returns', label: 'Returns', roles: ['super_admin','pharmacy_admin','sales_person'] },
                  { href: '/dashboard/pharmacy/prescriptions', label: 'Prescriptions', roles: ['super_admin','pharmacy_admin','sales_person'] },
                  { href: '/dashboard/pharmacy/batches', label: 'Batches & Expiry', roles: ['super_admin','pharmacy_admin'] },
                  { href: '/dashboard/pharmacy/suppliers', label: 'Suppliers', roles: ['super_admin','pharmacy_admin'] },
                  { href: '/dashboard/pharmacy/purchase-orders', label: 'Purchase Orders', roles: ['super_admin','pharmacy_admin'] },
                  { href: '/dashboard/pharmacy/purchase-returns', label: 'Purchase Returns', roles: ['super_admin','pharmacy_admin'] },
                  { href: '/dashboard/pharmacy/customers', label: 'Customer Credit', roles: ['super_admin','pharmacy_admin'] },
                  { href: '/dashboard/pharmacy/stock', label: 'Stock Management', roles: ['super_admin','pharmacy_admin'] },
                  { href: '/dashboard/pharmacy/reports', label: 'Reports', roles: ['super_admin','pharmacy_admin'] },
                  { href: '/dashboard/pharmacy/medicines', label: 'Medicines', roles: ['super_admin','pharmacy_admin'] },
                ].filter(s => !user || s.roles.includes(user.role));
                const activeSub = bestMatchHref(pathname, subItems.map(s => s.href));
                return (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {subItems.map(sub => (
                      <Link key={sub.href} href={sub.href}
                        className={clsx('block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          sub.href === activeSub ? 'bg-white/20 text-white' : 'text-navy-300 hover:bg-white/10')}>
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                );
              })()}
              {/* Lab sub-nav */}
              {item.href === '/dashboard/lab' && pathname.startsWith('/dashboard/lab') && (() => {
                const subItems = [
                  { href: '/dashboard/lab/orders/new', label: 'New Order', roles: ['super_admin','receptionist','lab_technician','lab_senior_technologist','lab_pathologist'] },
                  { href: '/dashboard/lab/orders', label: 'All Orders', roles: ['super_admin','receptionist','lab_technician','lab_senior_technologist','lab_pathologist'] },
                  { href: '/dashboard/lab/worklist', label: 'Worklist', roles: ['super_admin','lab_technician','lab_senior_technologist'] },
                  { href: '/dashboard/lab/home-collections', label: 'Home Collections', roles: ['super_admin','lab_technician','lab_senior_technologist'] },
                  { href: '/dashboard/lab/reports', label: 'Reports', roles: ['super_admin','lab_technician','lab_senior_technologist','lab_pathologist'] },
                  { href: '/dashboard/lab/commissions', label: 'Commissions', roles: ['super_admin'] },
                  { href: '/dashboard/lab/antibiogram', label: 'Antibiogram', roles: ['super_admin','lab_technician','lab_senior_technologist','lab_pathologist'] },
                  { href: '/dashboard/lab/tests', label: 'Manage Tests', roles: ['super_admin'] },
                  { href: '/dashboard/lab/panels', label: 'Panels', roles: ['super_admin'] },
                  { href: '/dashboard/lab/reagents', label: 'Reagents', roles: ['super_admin'] },
                  { href: '/dashboard/lab/equipment', label: 'Equipment', roles: ['super_admin'] },
                ].filter(s => !user || s.roles.includes(user.role));
                const activeSub = bestMatchHref(pathname, subItems.map(s => s.href));
                return (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {subItems.map(sub => (
                      <Link key={sub.href} href={sub.href}
                        className={clsx('block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          sub.href === activeSub ? 'bg-white/20 text-white' : 'text-navy-300 hover:bg-white/10')}>
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                );
              })()}
              {/* IPD sub-nav */}
              {item.href === '/dashboard/ipd' && pathname.startsWith('/dashboard/ipd') && (() => {
                const subItems = [
                  { href: '/dashboard/ipd/admissions/new', label: 'Admit Patient', roles: ['super_admin','receptionist','ward_admin'] },
                  { href: '/dashboard/ipd/admissions', label: 'All Admissions', roles: ['super_admin','receptionist','ward_admin'] },
                  { href: '/dashboard/ipd/rooms', label: 'Rooms', roles: ['super_admin','ward_admin'] },
                  { href: '/dashboard/ipd/reports', label: 'IPD Reports', roles: ['super_admin','ward_admin'] },
                ].filter(s => !user || s.roles.includes(user.role));
                const activeSub = bestMatchHref(pathname, subItems.map(s => s.href));
                return (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {subItems.map(sub => (
                      <Link key={sub.href} href={sub.href}
                        className={clsx('block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          sub.href === activeSub ? 'bg-white/20 text-white' : 'text-navy-300 hover:bg-white/10')}>
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                );
              })()}
              {/* Surgery sub-nav */}
              {item.href === '/dashboard/surgery' && pathname.startsWith('/dashboard/surgery') && (() => {
                const subItems = [
                  { href: '/dashboard/surgery/records/new', label: 'New Surgery', roles: ['super_admin','receptionist','ward_admin'] },
                  { href: '/dashboard/surgery/records', label: 'All Records', roles: ['super_admin','receptionist','ward_admin'] },
                  { href: '/dashboard/surgery/reports', label: 'Reports', roles: ['super_admin','ward_admin'] },
                  { href: '/dashboard/surgery/types', label: 'Surgery Types', roles: ['super_admin'] },
                ].filter(s => !user || s.roles.includes(user.role));
                const activeSub = bestMatchHref(pathname, subItems.map(s => s.href));
                return (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {subItems.map(sub => (
                      <Link key={sub.href} href={sub.href}
                        className={clsx('block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          sub.href === activeSub ? 'bg-white/20 text-white' : 'text-navy-300 hover:bg-white/10')}>
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-white/10 text-[11px] text-navy-400">
        &copy; {new Date().getFullYear()} {clinicName}
      </div>
    </aside>
  );
}
