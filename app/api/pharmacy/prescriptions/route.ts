import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb, getUploadsDir } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

// Every route here reads the session cookie, so none of them can be statically
// generated at build time - declare that explicitly instead of letting Next.js
// discover it per-request (which otherwise logs a harmless but noisy
// 'Dynamic server usage' error to the console during `next build`).
export const dynamic = 'force-dynamic';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export async function GET(req: NextRequest) {
    try {
        await requireSession();
        const db = await getDb();
        const sp = req.nextUrl.searchParams;
        const conds: string[] = [];
        const vals: any[] = [];
        const saleId = sp.get('sale_id');
        const patientId = sp.get('patient_id');
        const q = sp.get('q')?.trim();
        const from = sp.get('from');
        const to = sp.get('to');
        if (saleId) {
            conds.push('sale_id = ?');
            vals.push(Number(saleId));
        }
        if (patientId) {
            conds.push('patient_id = ?');
            vals.push(Number(patientId));
        }
        if (q) {
            conds.push('(patient_name LIKE ? OR patient_phone LIKE ?)');
            vals.push(`%${q}%`, `%${q}%`);
        }
        if (from) {
            conds.push('LEFT(created_at, 10) >= ?');
            vals.push(from);
        }
        if (to) {
            conds.push('LEFT(created_at, 10) <= ?');
            vals.push(to);
        }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
        const prescriptions = await db.prepare(`SELECT id, sale_id, patient_id, patient_name, patient_phone, doctor_name, file_name, mime_type, file_size, notes, created_at
       FROM prescriptions ${where} ORDER BY created_at DESC LIMIT 500`).all(...vals);
        return ok({ prescriptions });
    }
    catch (err) {
        return handleApiError(err);
    }
}
export async function POST(req: NextRequest) {
    try {
        const session = await requireSession();
        const form = await req.formData();
        const file = form.get('file');
        if (!(file instanceof File))
            return fail('A file is required.');
        if (!ALLOWED_TYPES.includes(file.type))
            return fail('Only JPEG, PNG, WebP or PDF files are allowed.');
        if (file.size > MAX_SIZE)
            return fail('File is too large (max 10MB).');
        const saleId = form.get('sale_id') ? Number(form.get('sale_id')) : null;
        const patientId = form.get('patient_id') ? Number(form.get('patient_id')) : null;
        const patientName = String(form.get('patient_name') || '') || null;
        const patientPhone = String(form.get('patient_phone') || '') || null;
        const doctorName = String(form.get('doctor_name') || '') || null;
        const notes = String(form.get('notes') || '') || null;
        const ext = path.extname(file.name) || (file.type === 'application/pdf' ? '.pdf' : '.jpg');
        const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
        const dir = getUploadsDir('prescriptions');
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(dir, storedName), buffer);
        const db = await getDb();
        const result = await db.prepare(`INSERT INTO prescriptions
         (sale_id, patient_id, patient_name, patient_phone, doctor_name, file_name, file_path, mime_type, file_size, notes, uploaded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(saleId, patientId, patientName, patientPhone, doctorName, file.name, storedName, file.type, file.size, notes, session.id);
        return ok({ id: result.lastInsertRowid }, 201);
    }
    catch (err) {
        return handleApiError(err);
    }
}
