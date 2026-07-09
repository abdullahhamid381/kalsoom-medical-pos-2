'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { api } from '@/lib/api-client';

const FLAG_STYLES: Record<string, string> = {
  low: 'bg-amber-100 text-amber-800', high: 'bg-amber-100 text-amber-800',
  critical: 'bg-crimson-100 text-crimson-800', normal: 'bg-emerald-100 text-emerald-800'
};

function resultValue(h: any) {
  if (h.value_type === 'text') return h.value_text || '—';
  return `${h.value_numeric ?? '—'}${h.unit ? ' ' + h.unit : ''}`;
}

export default function PatientLabHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [patientName, setPatientName] = useState('');
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/api/patients/${id}`),
      api.get(`/api/lab/trend?patient_id=${id}`)
    ]).then(([p, t]) => {
      setPatientName(p.patient?.full_name || p.full_name || '');
      setTests(t.tests || []);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button onClick={() => router.push(`/dashboard/patients/${id}`)} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5">
        <ArrowLeft size={15}/> Back to patient
      </button>

      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900 flex items-center gap-2">
          <FlaskConical size={22} className="text-sky-600"/> Lab History — {patientName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Every historical lab result for this patient, grouped by test.</p>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}
      {loading && <div className="kmc-card p-8 text-center text-gray-400">Loading...</div>}
      {!loading && tests.length === 0 && <div className="kmc-card p-8 text-center text-gray-400">No lab results recorded yet.</div>}

      {tests.map((t: any) => (
        <div key={t.test_id} className="kmc-card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-mist/60">
            <h3 className="font-display font-semibold text-navy-900 text-sm">{t.test_name}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                {['Date', 'Order No', 'Result', 'Flag'].map(h => <th key={h} className="px-5 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {t.history.map((h: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 text-gray-500">{new Date(h.created_at).toLocaleDateString('en-PK')}</td>
                  <td className="px-5 py-2.5 font-mono-num text-navy-800">{h.order_no}</td>
                  <td className="px-5 py-2.5 font-mono-num font-semibold text-navy-900">{resultValue(h)}</td>
                  <td className="px-5 py-2.5">{h.flag && <span className={`kmc-badge ${FLAG_STYLES[h.flag] || ''}`}>{h.flag}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
