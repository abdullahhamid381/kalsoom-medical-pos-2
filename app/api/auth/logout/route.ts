import { SESSION_COOKIE } from '@/lib/auth';
import { ok } from '@/lib/http';

export async function POST() {
  const res = ok({ loggedOut: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
