import { getSession } from '@/lib/auth';
import { getClinicInfo } from '@/lib/clinic';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { SessionProvider } from '@/lib/session-context';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const clinic = getClinicInfo();

  return (
    <div className="min-h-screen bg-mist flex">
      <Sidebar user={session} clinicName={clinic.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={session} />
        <main className="flex-1 p-5 md:p-7 max-w-[1400px] w-full mx-auto">
          <SessionProvider user={session}>{children}</SessionProvider>
        </main>
      </div>
    </div>
  );
}
