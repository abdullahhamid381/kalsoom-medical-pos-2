import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';
export async function GET(_req: NextRequest) {
    try {
        await requireRole('super_admin', 'pharmacy_admin');
        const db = await getDb();
        const rows = await db.prepare(`SELECT patient_phone AS phone, MAX(patient_name) AS patient_name, COUNT(*) AS sale_count,
              SUM(total) AS total_billed, SUM(paid_amount) AS total_paid,
              SUM(total - paid_amount) AS outstanding
       FROM pharmacy_sales
       WHERE payment_status != 'paid' AND patient_phone IS NOT NULL AND patient_phone != ''
       GROUP BY patient_phone
       HAVING SUM(total - paid_amount) > 0
       ORDER BY outstanding DESC`).all();
        return ok({ customers: rows });
    }
    catch (err) {
        return handleApiError(err);
    }
}
