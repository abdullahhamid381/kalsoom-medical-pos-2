import { requireRole } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';
import { initWhatsApp, getWhatsAppStatus } from '@/lib/whatsapp';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await requireRole('super_admin');
    const result = await initWhatsApp();
    return ok({ ...result, ...getWhatsAppStatus() });
  } catch (err) {
    return handleApiError(err);
  }
}
