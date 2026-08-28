import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { createSessionToken, verifyPassword, SESSION_COOKIE } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';
export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();
        if (!username || !password)
            return fail('Username and password are required.');
        const db = await getDb();
        const user = await db
            .prepare(`SELECT * FROM users WHERE username = ? AND active = 1`)
            .get(String(username).trim().toLowerCase()) as any;
        if (!user)
            return fail('Invalid username or password.', 401);
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid)
            return fail('Invalid username or password.', 401);
        const token = await createSessionToken({
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            doctorId: user.doctor_id ?? null
        });
        const res = ok({ id: user.id, name: user.name, username: user.username, role: user.role });
        res.cookies.set(SESSION_COOKIE, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 12
        });
        return res;
    }
    catch (err) {
        return handleApiError(err);
    }
}
