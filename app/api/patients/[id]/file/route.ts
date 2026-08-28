import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { getPatientLedger } from '@/lib/patient-ledger';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'receptionist', 'receptionist_admin', 'doctor');
        const id = Number(params.id);
        const sp = req.nextUrl.searchParams;
        const from = sp.get('from') || undefined;
        const to = sp.get('to') || undefined;
        const ledger = await getPatientLedger(id, from, to);
        if (!ledger)
            return fail('Patient not found.', 404);
        return ok(ledger);
    }
    catch (err) {
        return handleApiError(err);
    }
}
