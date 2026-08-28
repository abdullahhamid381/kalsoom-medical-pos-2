import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, handleApiError } from '@/lib/http';
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const from = sp.get('from') || new Date().toISOString().slice(0, 10);
        const to = sp.get('to') || new Date().toISOString().slice(0, 10);
        const totals = await db.prepare(`
      SELECT COUNT(*) AS total_admissions,
        SUM(CASE WHEN status='admitted' THEN 1 ELSE 0 END) AS currently_admitted,
        SUM(CASE WHEN status='discharged' THEN 1 ELSE 0 END) AS discharged,
        COALESCE(SUM(paid_amount),0) AS total_collected,
        COALESCE(SUM(grand_total),0) AS total_billed,
        COALESCE(SUM(grand_total - discount - paid_amount),0) AS total_outstanding
      FROM admissions
      WHERE admission_date BETWEEN ? AND ?
    `).get(from, to);
        const roomOccupancy = await db.prepare(`
      SELECT r.room_no, r.room_type, r.price_per_day, r.status,
        COUNT(a.id) AS total_stays,
        COALESCE(SUM(a.days_stayed),0) AS total_days,
        COALESCE(SUM(a.room_charge_total),0) AS revenue
      FROM rooms r
      LEFT JOIN admissions a ON a.room_id = r.id AND a.admission_date BETWEEN ? AND ?
      WHERE r.active = 1
      GROUP BY r.id ORDER BY r.room_no
    `).all(from, to);
        const byDay = await db.prepare(`
      SELECT admission_date AS date, COUNT(*) AS admissions,
        COALESCE(SUM(paid_amount),0) AS collected
      FROM admissions WHERE admission_date BETWEEN ? AND ?
      GROUP BY admission_date ORDER BY admission_date
    `).all(from, to);
        const byRoomType = await db.prepare(`
      SELECT r.room_type, COUNT(a.id) AS count,
        COALESCE(SUM(a.room_charge_total),0) AS revenue
      FROM admissions a JOIN rooms r ON r.id = a.room_id
      WHERE a.admission_date BETWEEN ? AND ?
      GROUP BY r.room_type
    `).all(from, to);
        const currentlyAdmitted = await db.prepare(`
      SELECT a.admission_no, a.admission_date, a.days_stayed,
        p.full_name AS patient_name, p.phone AS patient_phone,
        r.room_no, r.room_type, d.name AS doctor_name
      FROM admissions a
      JOIN patients p ON p.id = a.patient_id
      JOIN rooms r ON r.id = a.room_id
      LEFT JOIN doctors d ON d.id = a.doctor_id
      WHERE a.status = 'admitted'
      ORDER BY a.admission_date ASC
    `).all();
        const availableRooms = await db.prepare(`SELECT COUNT(*) AS c FROM rooms WHERE status='available' AND active=1`).get() as {
            c: number;
        };
        const occupiedRooms = await db.prepare(`SELECT COUNT(*) AS c FROM rooms WHERE status='occupied' AND active=1`).get() as {
            c: number;
        };
        return ok({ from, to, totals, roomOccupancy, byDay, byRoomType, currentlyAdmitted, availableRooms: availableRooms.c, occupiedRooms: occupiedRooms.c });
    }
    catch (err) {
        return handleApiError(err);
    }
}
