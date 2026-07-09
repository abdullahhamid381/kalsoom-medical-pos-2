import { NextRequest } from 'next/server';
import { getDb, nextAdmissionNo } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { syncAutoRoomCharge } from '@/lib/ipdCharges';

const SEL = `
  SELECT a.*,
    p.full_name AS patient_name, p.phone AS patient_phone, p.age AS patient_age, p.gender AS patient_gender,
    r.room_no, r.room_type, r.price_per_day,
    d.name AS doctor_name, d.specialization,
    u.name AS admitted_by_name
  FROM admissions a
  JOIN patients p ON p.id = a.patient_id
  JOIN rooms r ON r.id = a.room_id
  LEFT JOIN doctors d ON d.id = a.doctor_id
  JOIN users u ON u.id = a.admitted_by_user_id
`;

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const db = getDb();
    const sp = req.nextUrl.searchParams;
    const conds: string[] = [];
    const vals: any[] = [];
    if (sp.get('status')) { conds.push('a.status = ?'); vals.push(sp.get('status')); }
    if (sp.get('q')) { conds.push('(p.full_name LIKE ? OR p.phone LIKE ? OR a.admission_no LIKE ?)'); const q = `%${sp.get('q')}%`; vals.push(q,q,q); }
    if (sp.get('from')) { conds.push('a.admission_date >= ?'); vals.push(sp.get('from')); }
    if (sp.get('to'))   { conds.push('a.admission_date <= ?'); vals.push(sp.get('to')); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const admissions = db.prepare(`${SEL} ${where} ORDER BY a.created_at DESC LIMIT 500`).all(...vals);
    return ok({ admissions });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const b = await req.json();
    if (!b.patient_id) return fail('Select a patient.');
    if (!b.room_id) return fail('Select a room.');

    const db = getDb();
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ? AND active = 1`).get(Number(b.room_id)) as any;
    if (!room) return fail('Room not found.');
    if (room.status === 'occupied') return fail(`Room ${room.room_no} is already occupied.`);

    const patient = db.prepare(`SELECT * FROM patients WHERE id = ?`).get(Number(b.patient_id)) as any;
    if (!patient) return fail('Patient not found.');

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const admission_no = nextAdmissionNo(db, dateStr);

    const tx = db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO admissions
          (admission_no, patient_id, room_id, doctor_id, admitted_by_user_id, diagnosis,
           admission_date, admission_time, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        admission_no, b.patient_id, b.room_id,
        b.doctor_id || null, session.id,
        b.diagnosis || null,
        b.admission_date || dateStr,
        b.admission_time || timeStr,
        b.notes || null
      );
      const admissionId = r.lastInsertRowid as number;
      // Auto-calculated room charge (days stayed x rate) — kept in sync automatically from here on,
      // so staff never need to add/update a "room" charge line by hand.
      syncAutoRoomCharge(db, admissionId, dateStr, timeStr, session.id);
      // Mark room occupied
      db.prepare(`UPDATE rooms SET status = 'occupied' WHERE id = ?`).run(b.room_id);
      return admissionId;
    });

    const admissionId = tx();
    const admission = db.prepare(`${SEL} WHERE a.id = ?`).get(admissionId);
    return ok({ admission }, 201);
  } catch (err) { return handleApiError(err); }
}
