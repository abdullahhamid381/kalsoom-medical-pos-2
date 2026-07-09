'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu } from 'lucide-react';
import type { SessionUser } from '@/lib/auth';
import { api } from '@/lib/api-client';

export default function Topbar({ user }: { user: SessionUser | null }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
    } catch {
      // ignore - we redirect either way
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-2 md:hidden">
          <Menu size={20} className="text-navy-800" />
        </div>
        <div className="hidden md:block">
          <p className="text-sm text-gray-500">
            Welcome back, <span className="font-semibold text-navy-900">{user?.name || 'User'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-navy-900 leading-tight">{user?.name}</p>
            <p className="text-[11px] uppercase tracking-wide text-crimson-600 font-bold leading-tight">
              {user?.role === 'super_admin' ? 'Super Admin'
                : user?.role === 'doctor' ? 'Doctor'
                : user?.role === 'pharmacy_admin' ? 'Pharmacy Admin'
                : user?.role === 'sales_person' ? 'Sales Person'
                : 'Receptionist'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-navy-800 text-white flex items-center justify-center font-display font-bold text-sm">
            {(user?.name || '?').charAt(0).toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Logout"
            className="w-9 h-9 rounded-full border border-gray-200 hover:bg-crimson-50 hover:border-crimson-200 flex items-center justify-center text-gray-500 hover:text-crimson-600 transition-colors disabled:opacity-50"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
