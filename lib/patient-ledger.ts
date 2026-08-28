import { getDb } from './db';
export type LedgerCategory = 'appointment' | 'lab' | 'pharmacy' | 'admission' | 'surgery';
export type LedgerEntry = {
    id: number;
    category: LedgerCategory;
    categoryLabel: string;
    date: string;
    no: string;
    description: string;
    doctor: string | null;
    billed: number;
    discount: number;
    paid: number;
    outstanding: number;
    paymentStatus: string;
    status: string | null;
    link: string;
};
const CATEGORY_LABELS: Record<LedgerCategory, string> = {
    appointment: 'Appointment',
    lab: 'Lab',
    pharmacy: 'Pharmacy',
    admission: 'Admission',
    surgery: 'Surgery'
};
function outstanding(billed: number, discount: number, paid: number) {
    return Math.max(billed - discount - paid, 0);
}
export async function getPatientLedger(patientId: number, from?: string, to?: string) {
    const db = await getDb();
    const patient = await db.prepare(`SELECT * FROM patients WHERE id = ?`).get(patientId) as any;
    if (!patient)
        return null;
    const ranged = Boolean(from && to);
    const rangeArgs = ranged ? [from, to] : [];
    const appointments = await db.prepare(`
    SELECT a.*, d.name AS doctor_name, d.specialization, u.name AS booked_by_name
    FROM appointments a JOIN doctors d ON d.id=a.doctor_id JOIN users u ON u.id=a.booked_by_user_id
    WHERE a.patient_id=? ${ranged ? 'AND a.appointment_date BETWEEN ? AND ?' : ''}
    ORDER BY a.appointment_date DESC`).all(patientId, ...rangeArgs) as any[];
    const labOrders = await db.prepare(`
    SELECT lo.*, u.name AS booked_by_name FROM lab_orders lo JOIN users u ON u.id=lo.booked_by_user_id
    WHERE lo.patient_id=? ${ranged ? 'AND LEFT(lo.created_at, 10) BETWEEN ? AND ?' : ''}
    ORDER BY lo.created_at DESC`).all(patientId, ...rangeArgs) as any[];
    const pharmacySales = await db.prepare(`
    SELECT ps.*, u.name AS sold_by_name FROM pharmacy_sales ps JOIN users u ON u.id=ps.sold_by_user_id
    WHERE ps.patient_id=? ${ranged ? 'AND LEFT(ps.created_at, 10) BETWEEN ? AND ?' : ''}
    ORDER BY ps.created_at DESC`).all(patientId, ...rangeArgs) as any[];
    const admissions = await db.prepare(`
    SELECT a.*, r.room_no, r.room_type, d.name AS doctor_name, u.name AS admitted_by_name
    FROM admissions a JOIN rooms r ON r.id=a.room_id LEFT JOIN doctors d ON d.id=a.doctor_id JOIN users u ON u.id=a.admitted_by_user_id
    WHERE a.patient_id=? ${ranged ? 'AND a.admission_date BETWEEN ? AND ?' : ''}
    ORDER BY a.admission_date DESC`).all(patientId, ...rangeArgs) as any[];
    const surgeries = await db.prepare(`
    SELECT sr.*, st.name AS surgery_name, st.category, d.name AS surgeon_name, u.name AS booked_by_name
    FROM surgery_records sr JOIN surgery_types st ON st.id=sr.surgery_type_id LEFT JOIN doctors d ON d.id=sr.surgeon_id JOIN users u ON u.id=sr.booked_by_user_id
    WHERE sr.patient_id=? ${ranged ? 'AND sr.surgery_date BETWEEN ? AND ?' : ''}
    ORDER BY sr.surgery_date DESC`).all(patientId, ...rangeArgs) as any[];
    const timeline: LedgerEntry[] = [
        ...appointments.map((a): LedgerEntry => ({
            id: a.id, category: 'appointment', categoryLabel: CATEGORY_LABELS.appointment,
            date: a.appointment_date, no: a.appointment_no,
            description: a.reason || `Consultation — Dr. ${a.doctor_name}`,
            doctor: a.doctor_name,
            billed: a.amount, discount: a.discount, paid: a.paid_amount,
            outstanding: outstanding(a.amount, a.discount, a.paid_amount),
            paymentStatus: a.payment_status, status: a.status,
            link: `/dashboard/appointments/${a.id}`
        })),
        ...labOrders.map((o): LedgerEntry => ({
            id: o.id, category: 'lab', categoryLabel: CATEGORY_LABELS.lab,
            date: o.created_at.slice(0, 10), no: o.order_no,
            description: 'Lab Order', doctor: o.referring_doctor || null,
            billed: o.subtotal, discount: o.discount, paid: o.paid_amount,
            outstanding: outstanding(o.subtotal, o.discount, o.paid_amount),
            paymentStatus: o.payment_status, status: o.status,
            link: `/dashboard/lab/orders/${o.id}`
        })),
        ...pharmacySales.map((s): LedgerEntry => ({
            id: s.id, category: 'pharmacy', categoryLabel: CATEGORY_LABELS.pharmacy,
            date: s.created_at.slice(0, 10), no: s.sale_no,
            description: 'Pharmacy Sale', doctor: null,
            billed: s.subtotal, discount: s.discount, paid: s.paid_amount,
            outstanding: outstanding(s.subtotal, s.discount, s.paid_amount),
            paymentStatus: s.payment_status, status: null,
            link: `/dashboard/pharmacy/sales/${s.id}`
        })),
        ...admissions.map((a): LedgerEntry => ({
            id: a.id, category: 'admission', categoryLabel: CATEGORY_LABELS.admission,
            date: a.admission_date, no: a.admission_no,
            description: `Admission — ${a.room_no} (${String(a.room_type || '').replace('_', ' ')})`,
            doctor: a.doctor_name,
            billed: a.grand_total, discount: a.discount, paid: a.paid_amount,
            outstanding: outstanding(a.grand_total, a.discount, a.paid_amount),
            paymentStatus: a.payment_status, status: a.status,
            link: `/dashboard/ipd/admissions/${a.id}`
        })),
        ...surgeries.map((s): LedgerEntry => ({
            id: s.id, category: 'surgery', categoryLabel: CATEGORY_LABELS.surgery,
            date: s.surgery_date, no: s.surgery_no,
            description: s.surgery_name, doctor: s.surgeon_name,
            billed: s.total_cost, discount: s.discount, paid: s.paid_amount,
            outstanding: outstanding(s.total_cost, s.discount, s.paid_amount),
            paymentStatus: s.payment_status, status: s.status,
            link: `/dashboard/surgery/records/${s.id}`
        }))
    ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const categories: Record<LedgerCategory, {
        count: number;
        billed: number;
        discount: number;
        paid: number;
        outstanding: number;
    }> = {
        appointment: { count: 0, billed: 0, discount: 0, paid: 0, outstanding: 0 },
        lab: { count: 0, billed: 0, discount: 0, paid: 0, outstanding: 0 },
        pharmacy: { count: 0, billed: 0, discount: 0, paid: 0, outstanding: 0 },
        admission: { count: 0, billed: 0, discount: 0, paid: 0, outstanding: 0 },
        surgery: { count: 0, billed: 0, discount: 0, paid: 0, outstanding: 0 }
    };
    for (const e of timeline) {
        const c = categories[e.category];
        c.count++;
        c.billed += e.billed;
        c.discount += e.discount;
        c.paid += e.paid;
        c.outstanding += e.outstanding;
    }
    const totals = Object.values(categories).reduce((acc, c) => ({
        billed: acc.billed + c.billed, discount: acc.discount + c.discount,
        paid: acc.paid + c.paid, outstanding: acc.outstanding + c.outstanding
    }), { billed: 0, discount: 0, paid: 0, outstanding: 0 });
    return {
        patient,
        appointments, labOrders, pharmacySales, admissions, surgeries,
        timeline,
        summary: {
            categories,
            totalRecords: timeline.length,
            totalBilled: totals.billed,
            totalDiscount: totals.discount,
            totalPaid: totals.paid,
            totalOutstanding: totals.outstanding,
            // kept for backward compatibility with existing callers
            appointmentTotal: categories.appointment.paid,
            labTotal: categories.lab.paid,
            pharmacyTotal: categories.pharmacy.paid,
            admissionTotal: categories.admission.paid,
            surgeryTotal: categories.surgery.paid,
            grandTotal: totals.paid,
            totalAppointments: categories.appointment.count,
            totalLabOrders: categories.lab.count,
            totalPharmacySales: categories.pharmacy.count,
            totalAdmissions: categories.admission.count,
            totalSurgeries: categories.surgery.count
        }
    };
}
