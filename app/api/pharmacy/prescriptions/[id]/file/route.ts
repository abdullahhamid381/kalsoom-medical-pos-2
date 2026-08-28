import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb, getUploadsDir } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { fail, handleApiError } from '@/lib/http';
export async function GET(_req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        await requireSession();
        const db = await getDb();
        const id = Number(params.id);
        const p = await db.prepare(`SELECT * FROM prescriptions WHERE id = ?`).get(id) as any;
        if (!p)
            return fail('Prescription not found.', 404);
        const filePath = path.join(getUploadsDir('prescriptions'), p.file_path);
        if (!fs.existsSync(filePath))
            return fail('File is missing on disk.', 404);
        const buffer = fs.readFileSync(filePath);
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': p.mime_type,
                'Content-Disposition': `inline; filename="${p.file_name.replace(/"/g, '')}"`,
                'Cache-Control': 'private, max-age=3600',
            },
        });
    }
    catch (err) {
        return handleApiError(err);
    }
}
