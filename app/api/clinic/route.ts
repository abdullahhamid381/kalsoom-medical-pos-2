import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';
import { getClinicInfo } from '@/lib/clinic';

export async function GET() {
  try {
    await requireSession();
    return ok(getClinicInfo());
  } catch (err) {
    return handleApiError(err);
  }
}
