'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus } from 'lucide-react';
import { api } from '@/lib/api-client';

export default function PatientsListPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = await api.get(`/api/patients${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
        if (active) setPatients(data.patients || []);
      } catch (err: any) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    const t = setTimeout(load, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Patients</h1>
          <p className="text-sm text-gray-500 mt-1">Search patient records and view their visit history.</p>
        </div>
        <a href="/dashboard/appointments/new" className="kmc-btn-accent flex items-center gap-2">
          <UserPlus size={16} /> Book New Patient
        </a>
      </div>

      <div className="kmc-card p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="kmc-input pl-9 max-w-md"
            placeholder="Search by name, phone or CNIC..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Phone</th>
              <th className="px-5 py-3 font-semibold">CNIC</th>
              <th className="px-5 py-3 font-semibold">Age / Gender</th>
              <th className="px-5 py-3 font-semibold">Registered</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && patients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400">
                  No patients found.
                </td>
              </tr>
            )}
            {patients.map((p) => (
              <tr
                key={p.id}
                className="border-b border-gray-50 last:border-0 hover:bg-mist/60 cursor-pointer"
                onClick={() => router.push(`/dashboard/patients/${p.id}`)}
              >
                <td className="px-5 py-3 font-medium text-navy-900">{p.full_name}</td>
                <td className="px-5 py-3 font-mono-num text-gray-700">{p.phone}</td>
                <td className="px-5 py-3 font-mono-num text-gray-500 text-xs">{p.cnic || '—'}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {p.age ? `${p.age} yrs` : '—'} {p.gender ? `• ${p.gender}` : ''}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
