'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api-client';

export type ReferringDoctor = { id: number; name: string; phone: string | null; commission_percent: number };

export default function ReferringDoctorSearch({
  selected,
  onSelect
}: {
  selected: ReferringDoctor | null;
  onSelect: (doctor: ReferringDoctor | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReferringDoctor[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/lab/referring-doctors?q=${encodeURIComponent(query.trim())}`);
        if (active) setResults(data.doctors || []);
      } catch { /* ignore search errors silently */ }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [query]);

  async function addNew() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const data = await api.post('/api/lab/referring-doctors', { name });
      onSelect(data.doctor);
      setQuery(''); setOpen(false);
    } catch { /* leave the search box open on failure */ }
    finally { setCreating(false); }
  }

  if (selected) {
    return (
      <div className="kmc-card p-3 flex items-center justify-between bg-navy-50/40 border-navy-100">
        <div>
          <p className="font-medium text-navy-900 text-sm">Dr. {selected.name}</p>
          {selected.phone && <p className="text-xs text-gray-500 font-mono-num">{selected.phone}</p>}
        </div>
        <button type="button" onClick={() => { onSelect(null); setQuery(''); }} className="text-gray-400 hover:text-crimson-600">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="kmc-input pl-9"
          placeholder="Search referring doctor by name..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && query.trim() && (
        <div className="absolute z-30 mt-1.5 w-full kmc-card max-h-64 overflow-y-auto shadow-pop">
          {loading && <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>}
          {!loading && results.map((d) => (
            <button key={d.id} type="button" onMouseDown={() => { onSelect(d); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-mist border-b border-gray-50 last:border-0">
              <p className="font-medium text-navy-900 text-sm">Dr. {d.name}</p>
              {d.phone && <p className="text-xs text-gray-500 font-mono-num">{d.phone}</p>}
            </button>
          ))}
          {!loading && (
            <button type="button" onMouseDown={addNew} disabled={creating}
              className="w-full text-left px-4 py-2.5 hover:bg-mist text-sm font-semibold text-crimson-600">
              {creating ? 'Adding...' : `+ Add "${query.trim()}" as new referring doctor`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
