/** Auto-calculates the room charge for an admission (days stayed × room rate) and keeps a single
 *  auto-generated `admission_charges` row in sync with it, so staff never have to manually add/update
 *  a "room" charge line. Safe to call repeatedly (e.g. on every page load while still admitted, and
 *  again at discharge with the final discharge date/time) — it always replaces its own prior row. */
export async function syncAutoRoomCharge(db: any, admissionId: number, asOfDate: string, asOfTime: string, userId: number) {
    const adm = await db.prepare(`SELECT a.admission_date, a.admission_time, r.price_per_day
     FROM admissions a JOIN rooms r ON r.id = a.room_id WHERE a.id = ?`).get(admissionId) as {
        admission_date: string;
        admission_time: string;
        price_per_day: number;
    } | undefined;
    if (!adm)
        return;
    const admitMs = new Date(`${adm.admission_date}T${adm.admission_time}`).getTime();
    const asOfMs = new Date(`${asOfDate}T${asOfTime}`).getTime();
    const days = Math.max(1, Math.ceil((asOfMs - admitMs) / (1000 * 60 * 60 * 24)));
    const total = days * adm.price_per_day;
    await db.prepare(`DELETE FROM admission_charges WHERE admission_id = ? AND charge_type = 'room' AND auto_generated = 1`).run(admissionId);
    await db.prepare(`
    INSERT INTO admission_charges (admission_id, charge_type, description, quantity, unit_price, total, charge_date, added_by_user_id, auto_generated)
    VALUES (?, 'room', ?, ?, ?, ?, ?, ?, 1)
  `).run(admissionId, `Room charges (${days} day${days > 1 ? 's' : ''} × Rs. ${adm.price_per_day}/day)`, days, adm.price_per_day, total, asOfDate, userId);
    await recalcTotals(db, admissionId);
}
export async function recalcTotals(db: any, admissionId: number) {
    const agg = await db.prepare(`SELECT charge_type, COALESCE(SUM(total),0) AS sub FROM admission_charges WHERE admission_id = ? GROUP BY charge_type`).all(admissionId) as {
        charge_type: string;
        sub: number;
    }[];
    const t: Record<string, number> = {};
    for (const r of agg)
        t[r.charge_type] = r.sub;
    const grand = Object.values(t).reduce((s, v) => s + v, 0);
    const adm = await db.prepare(`SELECT * FROM admissions WHERE id = ?`).get(admissionId) as any;
    const net = Math.max(grand - (adm?.discount || 0), 0);
    const pay_status = adm?.paid_amount >= net && net > 0 ? 'paid' : adm?.paid_amount > 0 ? 'partial' : 'unpaid';
    await db.prepare(`
    UPDATE admissions SET
      room_charge_total = ?, medicine_total = ?, lab_total = ?, procedure_total = ?, other_total = ?,
      grand_total = ?, payment_status = ?, updated_at = now_iso()
    WHERE id = ?
  `).run(t['room'] || 0, (t['medicine'] || 0) + (t['nursing'] || 0), t['lab'] || 0, t['procedure'] || 0, (t['doctor_fee'] || 0) + (t['other'] || 0), grand, pay_status, admissionId);
}
