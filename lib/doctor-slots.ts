import { Db } from './db';
// Accepts '9:00 AM', '09:00', '9:00' etc. and normalizes to 24-hour 'HH:MM' for sorting/storage.
export function normalizeSlotTime(raw: string): string | null {
    const s = raw.trim();
    const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
    if (!m)
        return null;
    let hour = Number(m[1]);
    const minute = Number(m[2]);
    const meridiem = m[3]?.toUpperCase();
    if (hour > 23 || minute > 59)
        return null;
    if (meridiem === 'PM' && hour < 12)
        hour += 12;
    if (meridiem === 'AM' && hour === 12)
        hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
export async function replaceSlots(db: Db, doctorId: number, rawSlots: unknown) {
    if (!Array.isArray(rawSlots))
        return;
    const times = Array.from(new Set(rawSlots
        .map((t) => normalizeSlotTime(String(t)))
        .filter((t): t is string => !!t))).sort();
    const tx = db.transaction(async () => {
        await db.prepare(`DELETE FROM doctor_slots WHERE doctor_id = ?`).run(doctorId);
        const insert = db.prepare(`INSERT INTO doctor_slots (doctor_id, slot_time) VALUES (?, ?)`);
        for (const t of times)
            await insert.run(doctorId, t);
    });
    await tx();
}
