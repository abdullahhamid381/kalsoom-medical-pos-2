'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { api } from '@/lib/api-client';

export type Patient = {
  id: number;
  full_name: string;
  phone: string;
  cnic?: string | null;
  age?: number | null;
  gender?: string | null;
  address?: string | null;
};

export default function PatientSearch({
  selected,
  onSelect
}: {
  selected: Patient | null;
  onSelect: (patient: Patient | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get(`/api/patients?q=${encodeURIComponent(query.trim())}`);
        if (active) setResults(data.patients || []);
      } catch {
        // ignore search errors silently
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  if (selected) {
    return (
      <div className="kmc-card p-4 flex items-start justify-between bg-navy-50/40 border-navy-100">
        <div>
          <p className="font-semibold text-navy-900">{selected.full_name}</p>
          <p className="text-sm text-gray-600 font-mono-num">{selected.phone}</p>
          {(selected.age || selected.gender) && (
            <p className="text-xs text-gray-500 mt-1">
              {selected.gender || ''} {selected.age ? `• ${selected.age} yrs` : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery('');
          }}
          className="text-gray-400 hover:text-crimson-600"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="kmc-input pl-9"
          placeholder="Search existing patient by name, phone or CNIC..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && query.trim() && (
        <div className="absolute z-30 mt-1.5 w-full kmc-card max-h-64 overflow-y-auto shadow-pop">
          {loading && <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">No matching patients found.</div>
          )}
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p);
                setOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-mist border-b border-gray-50 last:border-0"
            >
              <p className="font-medium text-navy-900 text-sm">{p.full_name}</p>
              <p className="text-xs text-gray-500 font-mono-num">{p.phone}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
