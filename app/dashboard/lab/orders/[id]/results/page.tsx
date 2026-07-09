'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, CheckCircle2, History, Unlock, FileClock } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import CultureSensitivityEntry from '@/components/CultureSensitivityEntry';

const FLAG_STYLES: Record<string, string> = {
  low: 'bg-amber-100 text-amber-800', high: 'bg-amber-100 text-amber-800',
  critical: 'bg-crimson-100 text-crimson-800', normal: 'bg-emerald-100 text-emerald-800'
};

type Row = {
  order_item_id: number; test_id: number; test_name: string; category: string | null; panel_name: string | null;
  is_culture: boolean;
  reference_display: string; reference_value_type: 'numeric' | 'text';
  result: { id: number; value_type: string; value_numeric: number | null; value_text: string | null; unit: string | null; flag: string | null; comment: string | null } | null;
};

export default function LabResultsPage() {
  const params = useParams();
  const router = useRouter();
  const session = useSession();
  const id = params.id as string;
  const isSuperAdmin = session?.role === 'super_admin';

  const [order, setOrder] = useState<any>(null);
  const [reportStatus, setReportStatus] = useState('pending');
  const [rows, setRows] = useState<Row[]>([]);
  const [values, setValues] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState('');
  const [trend, setTrend] = useState<Record<number, any[]>>({});
  const [corrections, setCorrections] = useState<Record<number, any[]>>({});
  const [cultureData, setCultureData] = useState<Record<number, any[]>>({});

  async function load() {
    setLoading(true);
    try {
      const [orderData, resultsData] = await Promise.all([
        api.get(`/api/lab/orders/${id}`),
        api.get(`/api/lab/orders/${id}/results`)
      ]);
      setOrder(orderData.order);
      setReportStatus(resultsData.order_status);
      setRows(resultsData.items || []);
      const init: Record<number, any> = {};
      for (const r of resultsData.items || []) {
        init[r.order_item_id] = r.result
          ? { value_type: r.result.value_type, value_numeric: r.result.value_numeric ?? '', value_text: r.result.value_text ?? '', unit: r.result.unit ?? '', comment: r.result.comment ?? '', flag: r.result.flag, delta_flag: (r.result as any).delta_flag, reason: '' }
          : { value_type: r.reference_value_type, value_numeric: '', value_text: '', unit: '', comment: '', flag: null, delta_flag: 0, reason: '' };
      }
      setValues(init);

      const cultureRows = (resultsData.items || []).filter((r: Row) => r.is_culture);
      if (cultureRows.length > 0) {
        const cultureResults = await Promise.all(cultureRows.map((r: Row) => api.get(`/api/lab/orders/${id}/results/culture?order_item_id=${r.order_item_id}`)));
        const cultureInit: Record<number, any[]> = {};
        cultureRows.forEach((r: Row, i: number) => {
          cultureInit[r.order_item_id] = (cultureResults[i].organisms || []).map((o: any) => ({
            organism_id: o.organism_id, organism_name: o.organism_name, growth_count: o.growth_count || '',
            sensitivities: (o.sensitivities || []).map((s: any) => ({ antibiotic_id: s.antibiotic_id, antibiotic_name: s.antibiotic_name, result: s.result }))
          }));
        });
        setCultureData(cultureInit);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  function update(itemId: number, patch: any) {
    setValues(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }

  async function loadTrend(row: Row) {
    if (!order?.patient_id || trend[row.test_id]) return;
    try {
      const d = await api.get(`/api/lab/trend?patient_id=${order.patient_id}&test_id=${row.test_id}`);
      setTrend(prev => ({ ...prev, [row.test_id]: d.history || [] }));
    } catch { /* trend is a nice-to-have; ignore failures */ }
  }

  async function loadCorrections(row: Row) {
    const resultId = row.result?.id;
    if (!resultId || corrections[resultId]) return;
    try {
      const d = await api.get(`/api/lab/results/${resultId}/amendments`);
      setCorrections(prev => ({ ...prev, [resultId]: d.amendments || [] }));
    } catch { /* best-effort */ }
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const results = rows.map(r => {
        const v = values[r.order_item_id];
        return {
          order_item_id: r.order_item_id, value_type: v.value_type,
          value_numeric: v.value_type === 'numeric' ? v.value_numeric : undefined,
          value_text: v.value_type === 'text' ? v.value_text : undefined,
          unit: v.unit, comment: v.comment, reason: v.reason
        };
      }).filter(r => (r.value_numeric !== '' && r.value_numeric != null) || (r.value_text && r.value_text.trim()));
      if (results.length === 0) { setError('Enter at least one result before saving.'); setSaving(false); return; }
      await api.put(`/api/lab/orders/${id}/results`, { results });
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleReview() {
    if (!confirm('Mark these results as reviewed? A pathologist will need to finalize next.')) return;
    setFinalizing(true); setError('');
    try {
      await handleSave();
      await api.post(`/api/lab/orders/${id}/report/review`);
      await load();
    } catch (e: any) { setError(e.message); }
    finally { setFinalizing(false); }
  }

  async function handleFinalize() {
    if (!confirm('Finalize this report? It will become read-only until unlocked.')) return;
    setFinalizing(true); setError('');
    try {
      await api.post(`/api/lab/orders/${id}/report/finalize`);
      router.push(`/dashboard/lab/orders/${id}`);
    } catch (e: any) { setError(e.message); }
    finally { setFinalizing(false); }
  }

  async function handleSendBack() {
    if (!confirm('Send this report back to the technician for correction?')) return;
    try { await api.post(`/api/lab/orders/${id}/report/send-back`); await load(); }
    catch (e: any) { setError(e.message); }
  }

  async function handleUnlock() {
    if (!confirm('Unlock this finalized report for correction?')) return;
    try { await api.post(`/api/lab/orders/${id}/report/unlock`); load(); }
    catch (e: any) { setError(e.message); }
  }

  const role = session?.role;
  const canEnter = role === 'lab_technician' || role === 'lab_senior_technologist' || isSuperAdmin;
  const canReview = role === 'lab_senior_technologist' || isSuperAdmin;
  const canFinalize = role === 'lab_pathologist' || isSuperAdmin;
  const readOnly = !(canEnter && ['pending', 'entered'].includes(reportStatus));

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <button onClick={() => router.push(`/dashboard/lab/orders/${id}`)} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5">
        <ArrowLeft size={15}/> Back to order
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Enter Results — {order?.order_no}</h1>
          <p className="text-sm text-gray-500 mt-1">{order?.patient_name} · {order?.patient_age ?? '—'} yrs / {order?.patient_gender || '—'}</p>
        </div>
        {reportStatus === 'reported' && (
          <span className="kmc-badge bg-emerald-100 text-emerald-800 flex items-center gap-1.5"><CheckCircle2 size={13}/> Report Finalized</span>
        )}
        {reportStatus === 'reviewed' && (
          <span className="kmc-badge bg-sky-100 text-sky-800 flex items-center gap-1.5"><CheckCircle2 size={13}/> Reviewed — Awaiting Pathologist Sign-off</span>
        )}
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <div className="kmc-card divide-y divide-gray-50">
        {rows.map(row => {
          const v = values[row.order_item_id] || {};
          return (
            <div key={row.order_item_id} className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  {row.panel_name && <p className="text-xs font-semibold text-crimson-600 uppercase tracking-wide">{row.panel_name}</p>}
                  <p className="font-semibold text-navy-900">{row.test_name}</p>
                  <p className="text-xs text-gray-400">Reference: {row.reference_display}</p>
                </div>
                <div className="flex items-center gap-2">
                  {v.flag && <span className={`kmc-badge ${FLAG_STYLES[v.flag] || ''}`}>{v.flag}</span>}
                  {v.delta_flag === 1 && <span className="kmc-badge bg-amber-100 text-amber-800" title="More than 20% different from the patient's last result for this test">&Delta; Delta</span>}
                  <button type="button" onClick={() => loadTrend(row)} className="text-xs text-gray-400 hover:text-navy-700 flex items-center gap-1"><History size={13}/> History</button>
                  {row.result?.id && (
                    <button type="button" onClick={() => loadCorrections(row)} className="text-xs text-gray-400 hover:text-navy-700 flex items-center gap-1"><FileClock size={13}/> Corrections</button>
                  )}
                </div>
              </div>

              {trend[row.test_id] && (
                <div className="bg-mist/60 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                  {trend[row.test_id].length === 0 && <p>No previous results for this test.</p>}
                  {trend[row.test_id].map((h: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span>{new Date(h.created_at).toLocaleDateString('en-PK')} ({h.order_no})</span>
                      <span className="font-mono-num">{h.value_type === 'text' ? h.value_text : `${h.value_numeric ?? '—'} ${h.unit || ''}`}</span>
                    </div>
                  ))}
                </div>
              )}

              {row.result?.id && corrections[row.result.id] && (
                <div className="bg-mist/60 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                  {corrections[row.result.id].length === 0 && <p>No corrections recorded for this result.</p>}
                  {corrections[row.result.id].map((c: any) => (
                    <div key={c.id} className="flex justify-between gap-3">
                      <span>{new Date(c.amended_at).toLocaleString('en-PK')} — {c.amended_by_name}{c.reason ? `: ${c.reason}` : ''}</span>
                      <span className="font-mono-num shrink-0">{c.old_value_numeric ?? c.old_value_text ?? '—'} &rarr; {c.new_value_numeric ?? c.new_value_text ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )}

              {row.is_culture ? (
                <CultureSensitivityEntry
                  orderId={id}
                  orderItemId={row.order_item_id}
                  readOnly={readOnly}
                  initial={cultureData[row.order_item_id] || []}
                  onSave={(organisms) => setCultureData(prev => ({ ...prev, [row.order_item_id]: organisms }))}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="kmc-label">Type</label>
                      <select disabled={readOnly} className="kmc-input" value={v.value_type} onChange={e => update(row.order_item_id, { value_type: e.target.value })}>
                        <option value="numeric">Numeric</option><option value="text">Text</option>
                      </select>
                    </div>
                    {v.value_type === 'numeric' ? (
                      <>
                        <div><label className="kmc-label">Value</label><input disabled={readOnly} type="number" step="any" className="kmc-input font-mono-num" value={v.value_numeric} onChange={e => update(row.order_item_id, { value_numeric: e.target.value })} /></div>
                        <div><label className="kmc-label">Unit</label><input disabled={readOnly} className="kmc-input" value={v.unit} onChange={e => update(row.order_item_id, { unit: e.target.value })} /></div>
                      </>
                    ) : (
                      <div className="sm:col-span-2"><label className="kmc-label">Value</label><input disabled={readOnly} className="kmc-input" value={v.value_text} onChange={e => update(row.order_item_id, { value_text: e.target.value })} /></div>
                    )}
                    <div><label className="kmc-label">Comment</label><input disabled={readOnly} className="kmc-input" value={v.comment} onChange={e => update(row.order_item_id, { comment: e.target.value })} /></div>
                  </div>
                  {order?.reported_at && !readOnly && (
                    <div>
                      <label className="kmc-label">Reason for change (required — this report was already delivered)</label>
                      <input className="kmc-input" placeholder="e.g. Repeat test requested by pathologist" value={v.reason || ''} onChange={e => update(row.order_item_id, { reason: e.target.value })} />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3">
        {reportStatus === 'reported' && isSuperAdmin && (
          <button onClick={handleUnlock} className="kmc-btn-ghost flex items-center gap-2"><Unlock size={16}/> Unlock for Correction</button>
        )}
        {['pending', 'entered'].includes(reportStatus) && canEnter && (
          <button onClick={handleSave} disabled={saving} className="kmc-btn-ghost flex items-center gap-2"><Save size={16}/> {saving ? 'Saving...' : 'Save Draft'}</button>
        )}
        {reportStatus === 'entered' && canReview && (
          <button onClick={handleReview} disabled={finalizing} className="kmc-btn-accent flex items-center gap-2"><CheckCircle2 size={16}/> {finalizing ? 'Saving...' : 'Mark Reviewed'}</button>
        )}
        {reportStatus === 'reviewed' && (canReview || canFinalize) && (
          <button onClick={handleSendBack} className="kmc-btn-ghost flex items-center gap-2">Send Back to Technician</button>
        )}
        {reportStatus === 'reviewed' && canFinalize && (
          <button onClick={handleFinalize} disabled={finalizing} className="kmc-btn-accent flex items-center gap-2"><CheckCircle2 size={16}/> {finalizing ? 'Finalizing...' : 'Finalize Report'}</button>
        )}
      </div>
    </div>
  );
}
