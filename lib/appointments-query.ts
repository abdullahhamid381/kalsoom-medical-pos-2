export function appointmentSelect() {
  return `
    SELECT a.*, 
           p.full_name AS patient_name, p.phone AS patient_phone, p.cnic AS patient_cnic,
           p.age AS patient_age, p.gender AS patient_gender, p.address AS patient_address,
           d.name AS doctor_name, d.specialization, d.department AS doctor_department, d.fee AS doctor_fee,
           u.name AS booked_by_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    JOIN users u ON u.id = a.booked_by_user_id
  `;
}
