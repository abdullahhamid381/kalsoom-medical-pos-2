'use client';
import { useEffect, useState } from 'react';
import { Microscope } from 'lucide-react';
import { api } from '@/lib/api-client';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

export default function AntibiogramPage() {
  const [from, setFrom] = useState(daysAgo(89));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true; setLoading(true);
    api.get(`/api/lab/antibiogram?from=${from}&to=${to}`)
      .then(d => { if (active) setRows(d.rows || []); })
      .catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to]);

  const organisms = Array.from(new Set(rows.map(r => r.organism))).sort();
  const antibiotics = Array.from(new Set(rows.map(r => r.antibiotic))).sort();
  const cell = (organism: string, antibiotic: string) => rows.find(r => r.organism === organism && r.antibiotic === antibiotic);

  function pct(susceptible: number, total: number) { return total ? Math.round((susceptible / total) * 100) : null; }
  function cellColor(p: number | null) {
    if (p == null) return '#f3f4f6';
    if (p >= 80) return '#d1fae5';
    if (p >= 50) return '#fef3c7';
    return '#fee2e2';
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2"><Microscope size={22} className="text-sky-600"/> Antibiogram</h1>
        <p className="text-sm text-gray-500 mt-1">% susceptible per organism &times; antibiotic, from culture &amp; sensitivity results.</p>
      </div>

      <div className="kmc-card p-4 flex flex-wrap items-center gap-3">
        <input type="date" className="kmc-input max-w-[160px]" value={from} onChange={e => setFrom(e.target.value)}/>
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" className="kmc-input max-w-[160px]" value={to} onChange={e => setTo(e.target.value)}/>
      </div>

      {loading ? <div className="kmc-card p-8 text-center text-gray-400">Loading...</div> : organisms.length === 0 ? (
        <div className="kmc-card p-8 text-center text-gray-400">No culture &amp; sensitivity data in this range.</div>
      ) : (
        <div className="kmc-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-3 py-2.5 font-semibold sticky left-0 bg-white">Organism</th>
                {antibiotics.map(a => <th key={a} className="px-3 py-2.5 font-semibold whitespace-nowrap">{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {organisms.map(org => (
                <tr key={org} className="border-b border-gray-50 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-navy-900 sticky left-0 bg-white whitespace-nowrap">{org}</td>
                  {antibiotics.map(ab => {
                    const c = cell(org, ab);
                    const p = c ? pct(c.susceptible, c.total) : null;
                    return (
                      <td key={ab} className="px-3 py-2.5 text-center font-mono-num" style={{ background: cellColor(p) }}>
                        {p != null ? `${p}%` : '—'}
                        {c && <div className="text-[10px] text-gray-400">n={c.total}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
