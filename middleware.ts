import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'kmc_session';
function getSecretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me');
}

// Super admin only (clinic staff management etc.)
const SUPER_ADMIN_ONLY = ['/dashboard/settings', '/dashboard/pharmacy/medicines', '/dashboard/lab/tests', '/dashboard/lab/panels', '/dashboard/lab/equipment', '/dashboard/ipd/rooms', '/dashboard/surgery/types'];

// Doctors roster: super_admin manages everyone, receptionist_admin can also manage it (add/edit doctors + slots).
const DOCTORS_ROLES = ['super_admin', 'receptionist_admin'];

// Staff user management: super_admin manages everyone, receptionist_admin only manages receptionist logins (enforced in the API).
const USERS_ROLES = ['super_admin', 'receptionist_admin'];

const PHARMACY_ROLES = ['super_admin', 'pharmacy_admin', 'sales_person'];
const CLINIC_ROLES   = ['super_admin', 'receptionist', 'doctor'];
const LAB_ROLES      = ['super_admin', 'receptionist', 'lab_technician', 'lab_senior_technologist', 'lab_pathologist'];
const IPD_ROLES      = ['super_admin', 'receptionist', 'ward_admin'];

const PHARMACY_PATHS = ['/dashboard/pharmacy'];
const CLINIC_PATHS   = ['/dashboard/appointments', '/dashboard/patients', '/dashboard/scan'];
const LAB_PATHS      = ['/dashboard/lab'];
const IPD_PATHS      = ['/dashboard/ipd'];
const SURGERY_PATHS  = ['/dashboard/surgery'];

const DOCTOR_BLOCKED = ['/dashboard/appointments/new', '/dashboard/patients'];

// Receptionist Admin: scoped to appointment-desk features only - booking/managing
// appointments, patients, the scan lookup, and its own receptionist-account management.
const RECEPTIONIST_ADMIN_PATHS = ['/dashboard/appointments', '/dashboard/patients', '/dashboard/scan', '/dashboard/doctors', '/dashboard/users', '/dashboard/reports'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  let user: { role?: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecretKey());
      user = payload as { role?: string };
    } catch { user = null; }
  }

  const isAuthPage   = pathname === '/login';
  const isDashboard  = pathname.startsWith('/dashboard');
  const isPrint      = pathname.startsWith('/print');

  // Must be logged in to access dashboard or print pages
  if ((isDashboard || isPrint) && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in users shouldn't see login page
  if (isAuthPage && user) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (!isDashboard || !user) return NextResponse.next();

  const role = user.role || '';

  // Super admin only paths
  if (role !== 'super_admin' && SUPER_ADMIN_ONLY.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Staff user management: super_admin + receptionist_admin only
  if (!USERS_ROLES.includes(role) && pathname.startsWith('/dashboard/users')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Doctors roster: super_admin + receptionist_admin only
  if (!DOCTORS_ROLES.includes(role) && pathname.startsWith('/dashboard/doctors')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Receptionist Admin only sees appointment-desk features (appointments, patients, scan, doctors, staff users)
  if (role === 'receptionist_admin') {
    const allowed = pathname === '/dashboard' || RECEPTIONIST_ADMIN_PATHS.some(p => pathname.startsWith(p));
    if (!allowed) return NextResponse.redirect(new URL('/dashboard/appointments', req.url));
  }

  // Pharmacy staff (pharmacy_admin / sales_person) cannot access clinic appointment features
  if (['pharmacy_admin','sales_person'].includes(role)) {
    if (CLINIC_PATHS.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard/pharmacy', req.url));
    }
    if (LAB_PATHS.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard/pharmacy', req.url));
    }
  }

  // Lab staff (technician / senior technologist / pathologist) can only access lab pages
  if (['lab_technician', 'lab_senior_technologist', 'lab_pathologist'].includes(role)) {
    if (CLINIC_PATHS.some(p => pathname.startsWith(p)) || PHARMACY_PATHS.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard/lab', req.url));
    }
  }

  // Ward admin can only access IPD pages + overview
  if (role === 'ward_admin') {
    const allowed = IPD_PATHS.some(p => pathname.startsWith(p)) || pathname === '/dashboard';
    if (!allowed) return NextResponse.redirect(new URL('/dashboard/ipd', req.url));
  }

  // Clinic-only staff cannot access IPD ward management pages
  if (['receptionist','doctor'].includes(role)) {
    if (IPD_PATHS.some(p => pathname.startsWith(p)) && !['receptionist'].includes(role)) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // Clinic-only staff (receptionist / doctor) cannot access pharmacy stock management
  if (['receptionist','doctor'].includes(role)) {
    if (PHARMACY_PATHS.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // sales_person can sell but cannot manage medicines stock, purchasing or supplier ledgers
  if (role === 'sales_person') {
    if (pathname.startsWith('/dashboard/pharmacy/medicines') ||
        pathname.startsWith('/dashboard/pharmacy/stock') ||
        pathname.startsWith('/dashboard/pharmacy/reports') ||
        pathname.startsWith('/dashboard/pharmacy/batches') ||
        pathname.startsWith('/dashboard/pharmacy/suppliers') ||
        pathname.startsWith('/dashboard/pharmacy/purchase-orders') ||
        pathname.startsWith('/dashboard/pharmacy/purchase-returns') ||
        pathname.startsWith('/dashboard/pharmacy/customers')) {
      return NextResponse.redirect(new URL('/dashboard/pharmacy', req.url));
    }
  }

  // Doctor blocks
  if (role === 'doctor') {
    const isEditPath = /^\/dashboard\/appointments\/[^/]+\/edit$/.test(pathname);
    if (isEditPath || DOCTOR_BLOCKED.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/print/:path*']
};
