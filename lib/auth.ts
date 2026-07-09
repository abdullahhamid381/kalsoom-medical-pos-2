import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'kmc_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 hours

function getSecretKey() {
  const secret = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: number;
  name: string;
  username: string;
  role: 'super_admin' | 'receptionist' | 'doctor' | 'pharmacy_admin' | 'sales_person' | 'lab_technician' | 'ward_admin' | 'lab_senior_technologist' | 'lab_pathologist';
  doctorId?: number | null;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/** Reads + verifies the session cookie on the server (Server Components, Route Handlers). */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new AuthError('Not authenticated', 401);
  }
  return session;
}

export async function requireRole(...roles: Array<'super_admin' | 'receptionist' | 'doctor' | 'pharmacy_admin' | 'sales_person' | 'lab_technician' | 'ward_admin' | 'lab_senior_technologist' | 'lab_pathologist'>): Promise<SessionUser> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new AuthError('Not authorized', 403);
  }
  return session;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
