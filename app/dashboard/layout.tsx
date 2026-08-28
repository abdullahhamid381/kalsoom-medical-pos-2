import { getSession } from '@/lib/auth';
import { getClinicInfo } from '@/lib/clinic';
import DashboardShell from '@/components/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const clinic = getClinicInfo();

  return (
    <DashboardShell user={session} clinicName={clinic.name}>
      {children}
    </DashboardShell>
  );
}
