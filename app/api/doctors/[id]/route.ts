import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
import { replaceSlots } from '@/lib/doctor-slots';
export async function PUT(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireRole('super_admin', 'receptionist_admin');
        const id = Number(params.id);
        const body = await req.json();
        const db = await getDb();
        const updates: string[] = [];
        const values: any[] = [];
        const fields: Record<string, string> = {
            name: 'name',
            specialization: 'specialization',
            department: 'department',
            availability: 'availability',
            phone: 'phone',
            description: 'description'
        };
        for (const key of Object.keys(fields)) {
            if (typeof body[key] === 'string') {
                updates.push(`${fields[key]} = ?`);
                values.push(body[key].trim());
            }
        }
        if (body.fee !== undefined) {
            updates.push('fee = ?');
            values.push(Number(body.fee));
        }
        if (typeof body.active === 'boolean') {
            updates.push('active = ?');
            values.push(body.active ? 1 : 0);
        }
        if (body.slots !== undefined) {
            await replaceSlots(db, id, body.slots);
        }
        if (updates.length === 0) {
            if (body.slots !== undefined)
                return ok({ updated: true });
            return fail('Nothing to update.');
        }
        await db.prepare(`UPDATE doctors SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
        return ok({ updated: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function DELETE(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const session = await requireRole('super_admin', 'receptionist_admin');
        const id = Number(params.id);
        const db = await getDb();
        const force = req.nextUrl.searchParams.get('force') === 'true';
        const doctor = await db.prepare(`SELECT id FROM doctors WHERE id = ?`).get(id);
        if (!doctor)
            return fail('Doctor not found.', 404);
        const bookingCount = await db.prepare(`SELECT COUNT(*) AS c FROM appointments WHERE doctor_id = ?`).get(id) as {
            c: number;
        };
        if (bookingCount.c > 0 && !force) {
            await db.prepare(`UPDATE doctors SET active = 0 WHERE id = ?`).run(id);
            return ok({ deactivated: true, reason: 'This doctor has existing appointments, so they were deactivated instead of deleted to preserve appointment history.' });
        }
        if (bookingCount.c > 0 && force) {
            // Permanently erasing appointment/revenue history is irreversible - only super_admin may do it.
            if (session.role !== 'super_admin')
                return fail('Only a super admin can permanently delete a doctor with appointment history.', 403);
            db.pragma('foreign_keys = OFF');
            const tx = db.transaction(async () => {
                const apptIds = (await db.prepare(`SELECT id FROM appointments WHERE doctor_id = ?`).all(id) as {
                    id: number;
                }[]).map((r) => r.id);
                if (apptIds.length > 0) {
                    const placeholders = apptIds.map(() => '?').join(',');
                    await db.prepare(`UPDATE lab_orders SET appointment_id = NULL WHERE appointment_id IN (${placeholders})`).run(...apptIds);
                }
                await db.prepare(`DELETE FROM appointments WHERE doctor_id = ?`).run(id);
                await db.prepare(`UPDATE admissions SET doctor_id = NULL WHERE doctor_id = ?`).run(id);
                await db.prepare(`UPDATE surgery_records SET surgeon_id = NULL WHERE surgeon_id = ?`).run(id);
                await db.prepare(`UPDATE users SET doctor_id = NULL, active = 0 WHERE doctor_id = ?`).run(id);
                await db.prepare(`DELETE FROM doctor_slots WHERE doctor_id = ?`).run(id);
                await db.prepare(`DELETE FROM doctors WHERE id = ?`).run(id);
            });
            try {
                await tx();
            }
            finally {
                db.pragma('foreign_keys = ON');
            }
            return ok({ deleted: true, forced: true, reason: 'This doctor and all of their appointment history were permanently deleted.' });
        }
        await db.prepare(`DELETE FROM doctor_slots WHERE doctor_id = ?`).run(id);
        await db.prepare(`DELETE FROM doctors WHERE id = ?`).run(id);
        return ok({ deleted: true });
    }
    catch (err) {
        return handleApiError(err);
    }
}
