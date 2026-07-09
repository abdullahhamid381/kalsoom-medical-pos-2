import { requireRole } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';
import { initWhatsApp, getWhatsAppStatus } from '@/lib/whatsapp';

export async function POST() {
  try {
    await requireRole('super_admin');
    const result = await initWhatsApp();
    return ok({ ...result, ...getWhatsAppStatus() });
  } catch (err) {
    return handleApiError(err);
  }
}
