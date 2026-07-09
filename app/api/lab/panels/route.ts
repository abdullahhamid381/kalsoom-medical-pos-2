import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, requireSession } from '@/lib/auth';
import { ok, fail, handleApiError } from '@/lib/http';

function withMembers(db: any, panels: any[]) {
  const memberStmt = db.prepare(
    `SELECT lt.id, lt.name FROM lab_panel_tests lpt JOIN lab_tests lt ON lt.id = lpt.test_id WHERE lpt.panel_id = ? ORDER BY lt.name`
  );
  return panels.map((p) => ({ ...p, member_tests: memberStmt.all(p.id) }));
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const db = getDb();
    const q = req.nextUrl.searchParams.get('q')?.trim();
    const all = req.nextUrl.searchParams.get('all') === '1';
    const conds: string[] = [];
    const vals: any[] = [];
    if (!all) conds.push('active = 1');
    if (q) { conds.push('(name LIKE ? OR category LIKE ?)'); vals.push(`%${q}%`, `%${q}%`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const panels = db.prepare(`SELECT * FROM lab_panels ${where} ORDER BY category ASC, name ASC`).all(...vals);
    return ok({ panels: withMembers(db, panels) });
  } catch (err) { return handleApiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('super_admin');
    const b = await req.json();
    const name = String(b.name || '').trim();
    if (!name) return fail('Panel name is required.');
    const memberIds: number[] = Array.isArray(b.member_test_ids) ? b.member_test_ids.map(Number) : [];
    if (memberIds.length === 0) return fail('Select at least one member test.');

    const db = getDb();
    const tx = db.transaction(() => {
      const r = db.prepare(
        `INSERT INTO lab_panels (name, category, price, turnaround, description) VALUES (?, ?, ?, ?, ?)`
      ).run(name, b.category || null, Number(b.price || 0), b.turnaround || '24 hours', b.description || null);
      const panelId = r.lastInsertRowid as number;
      for (const testId of memberIds) {
        db.prepare(`INSERT OR IGNORE INTO lab_panel_tests (panel_id, test_id) VALUES (?, ?)`).run(panelId, testId);
      }
      return panelId;
    });
    return ok({ id: tx() }, 201);
  } catch (err) { return handleApiError(err); }
}
