import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { handleApiError, fail } from '@/lib/http';
import { appointmentSelect } from '@/lib/appointments-query';
import { generateAppointmentPdf } from '@/lib/pdf';
import { getClinicInfo } from '@/lib/clinic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    const db = getDb();
    const appt = db.prepare(`${appointmentSelect()} WHERE a.id = ?`).get(Number(params.id)) as any;
    if (!appt) return fail('Appointment not found.', 404);
    if (session.role === 'doctor' && appt.doctor_id !== session.doctorId) {
      return fail('Not authorized to view this appointment.', 403);
    }

    const pdfBuffer = await generateAppointmentPdf({
      clinic: getClinicInfo(),
      appointment: {
        appointment_no: appt.appointment_no,
        token_number: appt.token_number,
        appointment_date: appt.appointment_date,
        appointment_time: appt.appointment_time,
        department: appt.department,
        reason: appt.reason,
        payment_method: appt.payment_method,
        amount: appt.amount,
        discount: appt.discount,
        paid_amount: appt.paid_amount,
        payment_status: appt.payment_status,
        status: appt.status,
        notes: appt.notes,
        created_at: appt.created_at
      },
      patient: {
        full_name: appt.patient_name,
        phone: appt.patient_phone,
        cnic: appt.patient_cnic,
        age: appt.patient_age,
        gender: appt.patient_gender,
        address: appt.patient_address
      },
      doctor: {
        name: appt.doctor_name,
        specialization: appt.specialization,
        department: appt.doctor_department,
        fee: appt.doctor_fee
      },
      bookedBy: { name: appt.booked_by_name }
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${appt.appointment_no}.pdf"`
      }
    });
  } catch (err) {
    return handleApiError(err);
  }
}
