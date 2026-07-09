export function getClinicInfo() {
  return {
    name: process.env.CLINIC_NAME || 'Kalsoom Medical Complex',
    address: process.env.CLINIC_ADDRESS || 'Main Bazar Road, Bhakkar, Punjab, Pakistan',
    phone: process.env.CLINIC_PHONE || '+92-300-0000000',
    email: process.env.CLINIC_EMAIL || 'info@kalsoommedical.com'
  };
}
