'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, MessageCircle, CheckCircle2, Trash2, Pencil, Download } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { printThermal, surgeryReceiptHtml } from '@/lib/thermal-print';

const PAY_LABELS: Record<string,string> = { cash:'Cash',jazzcash:'JazzCash',easypaisa:'EasyPaisa',bank_transfer:'Bank Transfer',card:'Card' };
const STATUS_COLORS: Record<string,string> = { scheduled:'bg-amber-100 text-amber-800', completed:'bg-emerald-100 text-emerald-800', cancelled:'bg-gray-200 text-gray-600' };
const STATUSES = ['scheduled','completed','cancelled'];

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'same-origin' });
  const blob = await res.blob();
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(blob); });
}

export default function SurgeryRecordDetailPage() {
  return <Suspense fallback={<div className="text-center text-gray-400 py-16">Loading...</div>}><SurgeryRecordInner/></Suspense>;
}

function SurgeryRecordInner() {
  const { id } = useParams() as { id: string };
  const search = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const isNew = search.get('new') === '1';
  const isSuperAdmin = session?.role === 'super_admin';

  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    try { const d = await api.get(`/api/surgery/records/${id}`); setRec(d.record); } catch (e:any) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);

  async function handlePrint() {
    if (!rec) return;
    setPrinting(true);
    try {
      const [clinic, barcodeUrl] = await Promise.all([api.get('/api/clinic'), fetchAsDataUrl(`/api/surgery/records/${id}/barcode`)]);
      printThermal(surgeryReceiptHtml(rec, clinic, barcodeUrl));
    } catch { const clinic = await api.get('/api/clinic').catch(()=>({name:'Clinic',address:'',phone:''})); printThermal(surgeryReceiptHtml(rec, clinic)); }
    finally { setPrinting(false); }
  }

  async function handleWhatsApp() {
    try { const d = await api.post(`/api/surgery/records/${id}/whatsapp`); if (d.shareLink) window.open(d.shareLink, '_blank'); } catch (e:any) { setError(e.message); }
  }

  function openEdit() { setEditForm({ ...rec, surgery_fee: rec.surgery_fee, anesthesia_fee: rec.anesthesia_fee, theatre_fee: rec.theatre_fee, medicine_cost: rec.medicine_cost, other_charges: rec.other_charges, discount: rec.discount, paid_amount: rec.paid_amount }); setEditing(true); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try { const d = await api.put(`/api/surgery/records/${id}`, editForm); setRec(d.record); setEditing(false); } catch (e:any) { setError(e.message); } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm('Permanently delete this surgery record?')) return;
    setDeleting(true);
    try { await api.delete(`/api/surgery/records/${id}`); router.push('/dashboard/surgery/records'); } catch (e:any) { setError(e.message); setDeleting(false); }
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading...</div>;
  if (!rec && error) return <div className="kmc-card p-5 border-crimson-200 bg-crimson-50 text-crimson-700">{error}</div>;
  if (!rec) return null;

  const balance = Math.max(rec.total_cost - rec.discount - rec.paid_amount, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={()=>router.push('/dashboard/surgery/records')} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5"><ArrowLeft size={15}/>Back</button>
        <div className="flex gap-2">
          <button onClick={openEdit} className="text-sm text-navy-700 hover:text-crimson-600 flex items-center gap-1.5"><Pencil size={14}/>Edit</button>
          {isSuperAdmin && <button onClick={handleDelete} disabled={deleting} className="text-sm text-gray-400 hover:text-crimson-600 flex items-center gap-1.5"><Trash2 size={14}/>{deleting?'Deleting...':'Delete'}</button>}
        </div>
      </div>
      {isNew && <div className="kmc-card p-4 bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center gap-2 text-sm font-medium"><CheckCircle2 size={18}/>Surgery record saved.</div>}
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {/* Header */}
      <div className="kmc-card overflow-hidden">
        <div className="bg-navy-900 text-white px-6 py-5 flex items-start justify-between">
          <div><p className="font-display font-bold text-lg">{rec.surgery_no}</p><p className="text-navy-200 text-xs mt-0.5">{rec.surgery_date}{rec.surgery_time?` at ${rec.surgery_time}`:''}</p></div>
          <span className={`kmc-badge font-bold px-3 py-1.5 ${STATUS_COLORS[rec.status]||''}`}>{rec.status.toUpperCase()}</span>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div><p className="kmc-label">Patient</p><p className="font-semibold text-navy-900 text-base">{rec.patient_name}</p>{rec.patient_phone&&<p className="text-gray-500 font-mono-num text-xs">{rec.patient_phone}</p>}{(rec.patient_age||rec.patient_gender)&&<p className="text-gray-400 text-xs">{rec.patient_gender}·{rec.patient_age}yrs</p>}</div>
          <div><p className="kmc-label">Surgery</p><p className="font-semibold text-navy-900">{rec.surgery_name}</p><p className="text-gray-500 text-xs">{rec.surgery_category}</p></div>
          <div><p className="kmc-label">Surgeon</p><p className="text-gray-700">{rec.surgeon_name?`Dr.${rec.surgeon_name}`:'—'}</p></div>
          <div><p className="kmc-label">Theatre / Duration</p><p className="text-gray-700">{rec.theatre_no||'—'} · {rec.duration_hrs}hrs</p></div>
          {rec.anesthetist&&<div><p className="kmc-label">Anesthetist</p><p className="text-gray-700">{rec.anesthetist}</p></div>}
          {rec.diagnosis&&<div><p className="kmc-label">Diagnosis</p><p className="text-gray-600 text-xs">{rec.diagnosis}</p></div>}
          {rec.procedure_notes&&<div className="sm:col-span-2"><p className="kmc-label">Procedure Notes</p><p className="text-gray-600 text-xs">{rec.procedure_notes}</p></div>}
        </div>
        {/* Charges */}
        <div className="border-t border-gray-100 px-6 py-4 space-y-1.5 text-sm">
          {[['Surgeon Fee',rec.surgery_fee],['Anaesthesia Fee',rec.anesthesia_fee],['Theatre Fee',rec.theatre_fee],['Medicine Cost',rec.medicine_cost],['Other Charges',rec.other_charges]].map(([l,v])=> Number(v) > 0 ? (
            <div key={l as string} className="flex justify-between text-gray-500"><span>{l}</span><span className="font-mono-num">Rs.{v}</span></div>
          ) : null)}
          <div className="flex justify-between font-bold text-navy-900 text-base pt-1 border-t border-gray-100"><span>Total</span><span className="font-mono-num">Rs.{rec.total_cost}</span></div>
          {rec.discount>0&&<div className="flex justify-between text-gray-500"><span>Discount</span><span className="font-mono-num">Rs.{rec.discount}</span></div>}
          <div className="flex justify-between text-emerald-700"><span>Paid ({PAY_LABELS[rec.payment_method]||'—'})</span><span className="font-mono-num font-semibold">Rs.{rec.paid_amount}</span></div>
          {balance>0&&<div className="flex justify-between text-crimson-600 font-semibold"><span>Balance Due</span><span className="font-mono-num">Rs.{balance}</span></div>}
        </div>
        {/* Barcode */}
        <div className="px-6 pb-5 flex flex-col items-center gap-1">
          <img src={`/api/surgery/records/${id}/barcode`} alt="barcode" className="h-12" onError={e=>(e.currentTarget.style.display='none')}/>
          <p className="font-mono-num text-xs text-gray-400">{rec.surgery_no}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="kmc-card p-5 space-y-4">
        <h3 className="font-display font-semibold text-navy-900">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={handlePrint} disabled={printing} className="kmc-btn-ghost flex items-center gap-2"><Printer size={16}/>{printing?'Preparing...':'Print Receipt'}</button>
          {rec.patient_phone&&<button onClick={handleWhatsApp} className="kmc-btn-accent flex items-center gap-2"><MessageCircle size={16}/>Send via WhatsApp</button>}
        </div>
        <div>
          <p className="kmc-label mb-2">Update Status</p>
          <div className="flex gap-2">
            {STATUSES.map(s=>(
              <button key={s} onClick={async()=>{ const d = await api.put(`/api/surgery/records/${id}`,{status:s}); setRec(d.record); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${rec.status===s?`${STATUS_COLORS[s]||''} border-transparent shadow-sm scale-105`:'border-gray-200 text-gray-600 hover:bg-mist'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inline edit */}
      {editing && (
        <div className="kmc-card p-5">
          <h3 className="font-display font-semibold text-navy-900 mb-4">Edit Surgery Record</h3>
          <form onSubmit={handleSave} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><label className="kmc-label">Surgery Date</label><input type="date" className="kmc-input" value={editForm.surgery_date||''} onChange={e=>setEditForm({...editForm,surgery_date:e.target.value})}/></div>
            <div><label className="kmc-label">Surgery Time</label><input type="time" className="kmc-input" value={editForm.surgery_time||''} onChange={e=>setEditForm({...editForm,surgery_time:e.target.value})}/></div>
            <div><label className="kmc-label">Theatre No.</label><input className="kmc-input" value={editForm.theatre_no||''} onChange={e=>setEditForm({...editForm,theatre_no:e.target.value})}/></div>
            <div><label className="kmc-label">Anesthetist</label><input className="kmc-input" value={editForm.anesthetist||''} onChange={e=>setEditForm({...editForm,anesthetist:e.target.value})}/></div>
            <div><label className="kmc-label">Surgeon Fee</label><input type="number" min="0" className="kmc-input font-mono-num" value={editForm.surgery_fee||0} onChange={e=>setEditForm({...editForm,surgery_fee:Number(e.target.value)})}/></div>
            <div><label className="kmc-label">Anaesthesia Fee</label><input type="number" min="0" className="kmc-input font-mono-num" value={editForm.anesthesia_fee||0} onChange={e=>setEditForm({...editForm,anesthesia_fee:Number(e.target.value)})}/></div>
            <div><label className="kmc-label">Theatre Fee</label><input type="number" min="0" className="kmc-input font-mono-num" value={editForm.theatre_fee||0} onChange={e=>setEditForm({...editForm,theatre_fee:Number(e.target.value)})}/></div>
            <div><label className="kmc-label">Medicine Cost</label><input type="number" min="0" className="kmc-input font-mono-num" value={editForm.medicine_cost||0} onChange={e=>setEditForm({...editForm,medicine_cost:Number(e.target.value)})}/></div>
            <div><label className="kmc-label">Other Charges</label><input type="number" min="0" className="kmc-input font-mono-num" value={editForm.other_charges||0} onChange={e=>setEditForm({...editForm,other_charges:Number(e.target.value)})}/></div>
            <div><label className="kmc-label">Discount</label><input type="number" min="0" className="kmc-input font-mono-num" value={editForm.discount||0} onChange={e=>setEditForm({...editForm,discount:Number(e.target.value)})}/></div>
            <div><label className="kmc-label">Paid Amount</label><input type="number" min="0" className="kmc-input font-mono-num" value={editForm.paid_amount||0} onChange={e=>setEditForm({...editForm,paid_amount:Number(e.target.value)})}/></div>
            <div><label className="kmc-label">Payment Method</label>
              <select className="kmc-input" value={editForm.payment_method||'cash'} onChange={e=>setEditForm({...editForm,payment_method:e.target.value})}>
                {Object.entries(PAY_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="sm:col-span-3"><label className="kmc-label">Diagnosis</label><input className="kmc-input" value={editForm.diagnosis||''} onChange={e=>setEditForm({...editForm,diagnosis:e.target.value})}/></div>
            <div className="sm:col-span-3"><label className="kmc-label">Procedure Notes</label><textarea className="kmc-input" rows={2} value={editForm.procedure_notes||''} onChange={e=>setEditForm({...editForm,procedure_notes:e.target.value})}/></div>
            <div className="sm:col-span-3"><label className="kmc-label">Outcome</label><textarea className="kmc-input" rows={2} placeholder="Post-surgery outcome notes..." value={editForm.outcome||''} onChange={e=>setEditForm({...editForm,outcome:e.target.value})}/></div>
            <div className="sm:col-span-3 flex justify-end gap-3">
              <button type="button" onClick={()=>setEditing(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="kmc-btn-primary">{saving?'Saving...':'Save Changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
