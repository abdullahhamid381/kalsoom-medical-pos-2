'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { SessionProvider } from '@/lib/session-context';
import type { SessionUser } from '@/lib/auth';

export default function DashboardShell({
  user,
  clinicName,
  children
}: {
  user: SessionUser | null;
  clinicName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-mist flex">
      <Sidebar user={user} clinicName={clinicName} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-5 md:p-7 max-w-[1400px] w-full mx-auto">
          <SessionProvider user={user}>{children}</SessionProvider>
        </main>
      </div>
    </div>
  );
}
