import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { getPatientLedger } from '@/lib/patient-ledger';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole('super_admin', 'receptionist', 'doctor');
    const id = Number(params.id);
    const sp = req.nextUrl.searchParams;
    const from = sp.get('from') || undefined;
    const to = sp.get('to') || undefined;

    const ledger = getPatientLedger(id, from, to);
    if (!ledger) return fail('Patient not found.', 404);

    return ok(ledger);
  } catch (err) { return handleApiError(err); }
}
