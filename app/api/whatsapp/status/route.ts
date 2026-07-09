import { requireRole } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';
import { getWhatsAppStatus, isWhatsAppEnabled } from '@/lib/whatsapp';

export async function GET() {
  try {
    await requireRole('super_admin');
    return ok({ enabled: isWhatsAppEnabled(), ...getWhatsAppStatus() });
  } catch (err) {
    return handleApiError(err);
  }
}
