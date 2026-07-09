'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, MessageCircle, Download, CheckCircle2, Plus, Pencil, Trash2, LogOut } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { printThermal, admissionReceiptHtml } from '@/lib/thermal-print';

const CHARGE_TYPES = ['room','medicine','lab','procedure','doctor_fee','nursing','other'];
const CHARGE_LABELS: Record<string,string> = { room:'Room', medicine:'Medicine', lab:'Lab Test', procedure:'Procedure', doctor_fee:'Doctor Fee', nursing:'Nursing', other:'Other' };
const PAY_LABELS: Record<string,string> = { cash:'Cash',jazzcash:'JazzCash',easypaisa:'EasyPaisa',bank_transfer:'Bank Transfer',card:'Card' };
const TYPE_COLORS: Record<string,string> = { room:'bg-navy-100 text-navy-800', medicine:'bg-emerald-100 text-emerald-800', lab:'bg-sky-100 text-sky-800', procedure:'bg-purple-100 text-purple-800', doctor_fee:'bg-teal-100 text-teal-800', nursing:'bg-indigo-100 text-indigo-800', other:'bg-gray-100 text-gray-700' };

export default function AdmissionDetailPage() {
  return <Suspense fallback={<div className="text-center text-gray-400 py-16">Loading...</div>}><AdmissionDetailInner/></Suspense>;
}

function AdmissionDetailInner() {
  const { id } = useParams() as { id: string };
  const search = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const isNew = search.get('new') === '1';
  const isSuperAdmin = session?.role === 'super_admin';

  const [admission, setAdmission] = useState<any>(null);
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);

  // Add charge form
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState({ charge_type:'medicine', description:'', quantity:'1', unit_price:'', charge_date: new Date().toISOString().slice(0,10) });
  const [savingCharge, setSavingCharge] = useState(false);

  // Edit charge
  const [editCharge, setEditCharge] = useState<any>(null);

  // Discharge modal
  const [showDischarge, setShowDischarge] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({ discharge_date: new Date().toISOString().slice(0,10), discharge_time:'', discount:'0', paid_amount:'0', payment_method:'cash' });
  const [discharging, setDischarging] = useState(false);

  // Payment update
  const [showPayment, setShowPayment] = useState(false);
  const [payForm, setPayForm] = useState({ paid_amount:'0', discount:'0', payment_method:'cash' });
  const [savingPay, setSavingPay] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get(`/api/ipd/admissions/${id}`);
      setAdmission(d.admission);
      setCharges(d.charges || []);
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function handleAddCharge(e: React.FormEvent) {
    e.preventDefault(); setSavingCharge(true);
    try {
      await api.post(`/api/ipd/admissions/${id}/charges`, { ...chargeForm, quantity: Number(chargeForm.quantity), unit_price: Number(chargeForm.unit_price) });
      setShowAddCharge(false); setChargeForm({ charge_type:'medicine', description:'', quantity:'1', unit_price:'', charge_date: new Date().toISOString().slice(0,10) });
      load();
    } catch (e:any) { setError(e.message); }
    finally { setSavingCharge(false); }
  }

  async function handleEditCharge(e: React.FormEvent) {
    e.preventDefault(); setSavingCharge(true);
    try {
      await api.put(`/api/ipd/admissions/${id}/charges/${editCharge.id}`, { description: editCharge.description, quantity: Number(editCharge.quantity), unit_price: Number(editCharge.unit_price), charge_date: editCharge.charge_date });
      setEditCharge(null); load();
    } catch (e:any) { setError(e.message); }
    finally { setSavingCharge(false); }
  }

  async function handleDeleteCharge(cid: number) {
    if (!confirm('Remove this charge?')) return;
    try { await api.delete(`/api/ipd/admissions/${id}/charges/${cid}`); load(); }
    catch (e:any) { setError(e.message); }
  }

  function openDischarge() {
    const now = new Date();
    setDischargeForm({
      discharge_date: now.toISOString().slice(0, 10),
      discharge_time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      discount: String(admission.discount || 0),
      paid_amount: String(admission.paid_amount || 0),
      payment_method: admission.payment_method || 'cash'
    });
    setShowDischarge(true);
  }

  function dischargePreview() {
    const admitMs = new Date(`${admission.admission_date}T${admission.admission_time}`).getTime();
    const now = new Date();
    const dTime = dischargeForm.discharge_time || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dischargeMs = new Date(`${dischargeForm.discharge_date}T${dTime}`).getTime();
    const days = Math.max(1, Math.ceil((dischargeMs - admitMs) / (1000 * 60 * 60 * 24)));
    const roomFee = days * admission.price_per_day;
    const otherCharges = charges.filter((c: any) => !(c.charge_type === 'room' && c.auto_generated === 1)).reduce((s: number, c: any) => s + c.total, 0);
    const grandTotal = roomFee + otherCharges;
    const discount = Number(dischargeForm.discount || 0);
    const netPayable = Math.max(grandTotal - discount, 0);
    const paid = Number(dischargeForm.paid_amount || 0);
    const balanceDue = netPayable - paid;
    return { days, roomFee, otherCharges, grandTotal, netPayable, paid, balanceDue };
  }

  async function handleDischarge(e: React.FormEvent) {
    e.preventDefault(); setDischarging(true);
    try {
      const d = await api.post(`/api/ipd/admissions/${id}/discharge`, { ...dischargeForm, discount: Number(dischargeForm.discount), paid_amount: Number(dischargeForm.paid_amount) });
      // Send staff straight to this patient's overall expense report (total billed/discount/paid/outstanding
      // across every service, not just this admission) so they can see the full picture right after discharge.
      router.push(`/dashboard/patients/${d.admission.patient_id}`);
    } catch (e:any) { setError(e.message); setDischarging(false); }
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault(); setSavingPay(true);
    try {
      await api.put(`/api/ipd/admissions/${id}`, { paid_amount: Number(payForm.paid_amount), discount: Number(payForm.discount), payment_method: payForm.payment_method });
      setShowPayment(false); load();
    } catch (e:any) { setError(e.message); }
    finally { setSavingPay(false); }
  }

  async function handleWhatsApp() {
    try {
      const res = await api.post(`/api/ipd/admissions/${id}/whatsapp`);
      if (res.shareLink) window.open(res.shareLink, '_blank');
    } catch (e: any) { setError(e.message); }
  }

  async function handlePrint() {
    if (!admission) return;
    setPrinting(true);
    try {
      const clinic = await api.get('/api/clinic');
      printThermal(admissionReceiptHtml(admission, charges, clinic));
    } catch { /* silent */ } finally { setPrinting(false); }
  }

  if (loading) return <div className="text-center text-gray-400 py-16">Loading admission...</div>;
  if (!admission && error) return <div className="kmc-card p-5 border-crimson-200 bg-crimson-50 text-crimson-700">{error}</div>;
  if (!admission) return null;

  const isAdmitted = admission.status === 'admitted';
  const netPayable = Math.max(admission.grand_total - admission.discount, 0);
  const balance = netPayable - admission.paid_amount;
  const preview = showDischarge ? dischargePreview() : null;

  // Group charges by date for patient file view
  const byDate: Record<string, any[]> = {};
  for (const c of charges) {
    if (!byDate[c.charge_date]) byDate[c.charge_date] = [];
    byDate[c.charge_date].push(c);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/dashboard/ipd/admissions')} className="text-sm text-gray-500 hover:text-navy-800 flex items-center gap-1.5">
          <ArrowLeft size={15}/> Back to admissions
        </button>
        <div className="flex gap-2">
          {isSuperAdmin && <button onClick={async()=>{if(confirm('Delete this admission?')){await api.delete(`/api/ipd/admissions/${id}`);router.push('/dashboard/ipd/admissions');}}} className="text-sm text-gray-400 hover:text-crimson-600 flex items-center gap-1.5"><Trash2 size={14}/>Delete</button>}
        </div>
      </div>

      {isNew && <div className="kmc-card p-4 bg-emerald-50 border-emerald-200 text-emerald-800 flex items-center gap-2 text-sm font-medium"><CheckCircle2 size={18}/>Patient admitted successfully.</div>}
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {/* Header card */}
      <div className="kmc-card overflow-hidden">
        <div className={`px-6 py-5 flex items-start justify-between ${isAdmitted ? 'bg-teal-700' : 'bg-navy-900'} text-white`}>
          <div>
            <p className="font-display font-bold text-lg">{admission.admission_no}</p>
            <p className="text-white/70 text-xs mt-0.5">Admitted: {admission.admission_date} {admission.admission_time}</p>
            {admission.discharge_date && <p className="text-white/70 text-xs">Discharged: {admission.discharge_date} · {admission.days_stayed} days</p>}
          </div>
          <span className={`kmc-badge font-bold px-3 py-1.5 ${isAdmitted ? 'bg-emerald-100 text-emerald-900' : 'bg-gray-100 text-gray-700'}`}>
            {admission.status.toUpperCase()}
          </span>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
          <div><p className="kmc-label">Patient</p><p className="font-semibold text-navy-900 text-base">{admission.patient_name}</p><p className="text-gray-500 font-mono-num text-xs">{admission.patient_phone}</p>{(admission.patient_age||admission.patient_gender)&&<p className="text-gray-400 text-xs">{admission.patient_gender} · {admission.patient_age} yrs</p>}</div>
          <div><p className="kmc-label">Room</p><p className="font-mono-num font-bold text-navy-900 text-xl">{admission.room_no}</p><p className="text-gray-500 text-xs">{admission.room_type?.replace('_',' ')} · Floor: {admission.floor||'—'}</p><p className="text-gray-400 text-xs">Rs. {admission.price_per_day}/day</p></div>
          <div><p className="kmc-label">Attending Doctor</p><p className="font-semibold text-navy-900">{admission.doctor_name ? `Dr. ${admission.doctor_name}` : '—'}</p>{admission.diagnosis&&<p className="text-gray-500 text-xs mt-1">Dx: {admission.diagnosis}</p>}</div>
        </div>
        {/* Financial summary */}
        <div className="px-6 py-4 border-t border-gray-100 bg-mist/40">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            {[['Room',admission.room_charge_total],['Medicine',admission.medicine_total],['Lab',admission.lab_total],['Procedure',admission.procedure_total],['Other',admission.other_total]].map(([l,v])=>(
              <div key={l as string} className="text-center"><p className="text-xs text-gray-400">{l}</p><p className="font-mono-num font-semibold text-navy-800">Rs. {v}</p></div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
            <div className="flex gap-4 text-sm">
              <span className="text-gray-500">Grand Total: <span className="font-mono-num font-bold text-navy-900">Rs. {admission.grand_total}</span></span>
              {admission.discount>0&&<span className="text-gray-400">Discount: Rs. {admission.discount}</span>}
              <span className="text-emerald-700">Paid: <span className="font-mono-num font-semibold">Rs. {admission.paid_amount}</span></span>
              {balance>0&&<span className="text-crimson-600 font-semibold">Balance: Rs. {balance}</span>}
            </div>
            <span className={`kmc-badge ${admission.payment_status==='paid'?'bg-emerald-100 text-emerald-800':admission.payment_status==='partial'?'bg-amber-100 text-amber-800':'bg-crimson-100 text-crimson-800'}`}>{admission.payment_status}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="kmc-card p-5 space-y-3">
        <h3 className="font-display font-semibold text-navy-900">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={handlePrint} disabled={printing} className="kmc-btn-ghost flex items-center gap-2"><Printer size={16}/>{printing?'Preparing...':'Print Bill'}</button>
          <a href={`/api/ipd/admissions/${id}/pdf`} target="_blank" rel="noreferrer" className="kmc-btn-primary flex items-center gap-2"><Download size={16}/>Download PDF Bill</a>
          {admission.patient_phone && <button onClick={handleWhatsApp} className="kmc-btn-accent flex items-center gap-2"><MessageCircle size={16}/>'Send via WhatsApp'</button>}
          <button onClick={()=>{setPayForm({paid_amount:String(admission.paid_amount),discount:String(admission.discount),payment_method:admission.payment_method||'cash'});setShowPayment(!showPayment);}} className="kmc-btn-ghost flex items-center gap-2"><Pencil size={15}/>Update Payment</button>
          {isAdmitted && <button onClick={openDischarge} className="kmc-btn-accent flex items-center gap-2"><LogOut size={16}/>Discharge Patient</button>}
        </div>
{showPayment && (
          <form onSubmit={handleSavePayment} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
            <div><label className="kmc-label">Payment Method</label><select className="kmc-input" value={payForm.payment_method} onChange={e=>setPayForm({...payForm,payment_method:e.target.value})}>{Object.entries(PAY_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="kmc-label">Discount (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={payForm.discount} onChange={e=>setPayForm({...payForm,discount:e.target.value})}/></div>
            <div><label className="kmc-label">Paid Amount (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={payForm.paid_amount} onChange={e=>setPayForm({...payForm,paid_amount:e.target.value})}/></div>
            <div className="flex items-end gap-2"><button type="submit" disabled={savingPay} className="kmc-btn-primary flex-1">{savingPay?'Saving...':'Save'}</button><button type="button" onClick={()=>setShowPayment(false)} className="kmc-btn-ghost">Cancel</button></div>
          </form>
        )}

        {showDischarge && preview && (
          <div className="pt-3 border-t border-gray-100">
            <h4 className="font-semibold text-navy-900 mb-3">Discharge Patient</h4>
            <form onSubmit={handleDischarge} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="kmc-label">Discharge Date</label><input type="date" className="kmc-input" value={dischargeForm.discharge_date} onChange={e=>setDischargeForm({...dischargeForm,discharge_date:e.target.value})}/></div>
                <div><label className="kmc-label">Discharge Time</label><input type="time" className="kmc-input" value={dischargeForm.discharge_time} onChange={e=>setDischargeForm({...dischargeForm,discharge_time:e.target.value})}/></div>
                <div><label className="kmc-label">Payment Method</label><select className="kmc-input" value={dischargeForm.payment_method} onChange={e=>setDischargeForm({...dischargeForm,payment_method:e.target.value})}>{Object.entries(PAY_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
                <div><label className="kmc-label">Discount (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={dischargeForm.discount} onChange={e=>setDischargeForm({...dischargeForm,discount:e.target.value})}/></div>
                <div><label className="kmc-label">Paid Amount (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={dischargeForm.paid_amount} onChange={e=>setDischargeForm({...dischargeForm,paid_amount:e.target.value})}/></div>
              </div>

              {/* Auto-calculated bill preview — updates live as the fields above change */}
              <div className="kmc-card p-4 bg-mist/50 border-navy-100 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Room Fee (auto — {preview.days} day{preview.days>1?'s':''} × Rs. {admission.price_per_day}/day)</span><span className="font-mono-num font-semibold text-navy-900">Rs. {preview.roomFee.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Other Charges (medicine, lab, procedure, etc.)</span><span className="font-mono-num text-navy-800">Rs. {preview.otherCharges.toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold text-navy-900 pt-1.5 border-t border-gray-200"><span>Grand Total</span><span className="font-mono-num">Rs. {preview.grandTotal.toLocaleString()}</span></div>
                {Number(dischargeForm.discount) > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="font-mono-num">Rs. {Number(dischargeForm.discount).toLocaleString()}</span></div>}
                <div className="flex justify-between text-navy-900"><span>Net Payable</span><span className="font-mono-num font-semibold">Rs. {preview.netPayable.toLocaleString()}</span></div>
                <div className="flex justify-between text-emerald-700"><span>Paid</span><span className="font-mono-num font-semibold">Rs. {preview.paid.toLocaleString()}</span></div>
                <div className={`flex justify-between pt-1.5 border-t border-gray-200 font-bold ${preview.balanceDue > 0 ? 'text-crimson-600' : 'text-emerald-700'}`}>
                  <span>{preview.balanceDue > 0 ? 'Balance Due' : 'Fully Paid'}</span>
                  <span className="font-mono-num">Rs. {Math.abs(preview.balanceDue).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="submit" disabled={discharging} className="kmc-btn-accent flex-1">{discharging?'Processing...':'Confirm Discharge'}</button>
                <button type="button" onClick={()=>setShowDischarge(false)} className="kmc-btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Add charge */}
      <div className="kmc-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-navy-900">Add Charge</h3>
          <button onClick={()=>setShowAddCharge(!showAddCharge)} className="text-xs font-semibold text-navy-700 hover:text-crimson-600 flex items-center gap-1"><Plus size={13}/>Add</button>
        </div>
        {showAddCharge && (
          <form onSubmit={handleAddCharge} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div><label className="kmc-label">Type</label><select className="kmc-input" value={chargeForm.charge_type} onChange={e=>setChargeForm({...chargeForm,charge_type:e.target.value})}>{CHARGE_TYPES.map(t=><option key={t} value={t}>{CHARGE_LABELS[t]}</option>)}</select></div>
            <div className="lg:col-span-2"><label className="kmc-label">Description *</label><input className="kmc-input" placeholder="e.g. Paracetamol 500mg × 3 days" value={chargeForm.description} onChange={e=>setChargeForm({...chargeForm,description:e.target.value})} required/></div>
            <div><label className="kmc-label">Qty</label><input type="number" min="0.5" step="0.5" className="kmc-input font-mono-num" value={chargeForm.quantity} onChange={e=>setChargeForm({...chargeForm,quantity:e.target.value})}/></div>
            <div><label className="kmc-label">Unit Price (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={chargeForm.unit_price} onChange={e=>setChargeForm({...chargeForm,unit_price:e.target.value})} required/></div>
            <div><label className="kmc-label">Date</label><input type="date" className="kmc-input" value={chargeForm.charge_date} onChange={e=>setChargeForm({...chargeForm,charge_date:e.target.value})}/></div>
            <div className="flex gap-2 items-end sm:col-span-2 lg:col-span-5">
              <button type="submit" disabled={savingCharge} className="kmc-btn-primary">{savingCharge?'Adding...':'Add Charge'}</button>
              <button type="button" onClick={()=>setShowAddCharge(false)} className="kmc-btn-ghost">Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* Patient file — charges by date */}
      <div className="kmc-card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-display font-semibold text-navy-900">Patient File — All Charges</h3>
        </div>
        {charges.length === 0 && <p className="px-5 py-8 text-center text-gray-400 text-sm">No charges recorded yet.</p>}
        {Object.entries(byDate).map(([date, items]) => (
          <div key={date}>
            <div className="px-5 py-2 bg-mist/60 border-b border-gray-100">
              <p className="text-xs font-semibold text-navy-700 uppercase tracking-wide">{date}</p>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {items.map((c:any) => (
                  editCharge?.id === c.id ? (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td colSpan={6} className="px-5 py-3">
                        <form onSubmit={handleEditCharge} className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <input className="kmc-input sm:col-span-2" value={editCharge.description} onChange={e=>setEditCharge({...editCharge,description:e.target.value})} required/>
                          <input type="number" min="0.5" step="0.5" className="kmc-input" value={editCharge.quantity} onChange={e=>setEditCharge({...editCharge,quantity:e.target.value})}/>
                          <input type="number" min="0" className="kmc-input" value={editCharge.unit_price} onChange={e=>setEditCharge({...editCharge,unit_price:e.target.value})}/>
                          <div className="flex gap-1"><button type="submit" disabled={savingCharge} className="kmc-btn-primary text-xs flex-1">Save</button><button type="button" onClick={()=>setEditCharge(null)} className="kmc-btn-ghost text-xs">Cancel</button></div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-mist/40">
                      <td className="px-5 py-2.5 w-28"><span className={`kmc-badge text-[10px] ${TYPE_COLORS[c.charge_type]||''}`}>{CHARGE_LABELS[c.charge_type]||c.charge_type}</span></td>
                      <td className="px-3 py-2.5 text-navy-900">{c.description}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs font-mono-num">{c.quantity} × Rs. {c.unit_price}</td>
                      <td className="px-3 py-2.5 font-mono-num font-semibold text-navy-900 text-right">Rs. {c.total}</td>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">{c.added_by_name}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <button onClick={()=>setEditCharge({...c})} className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-mist"><Pencil size={11}/></button>
                          <button onClick={()=>handleDeleteCharge(c.id)} className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-400 hover:text-crimson-600"><Trash2 size={11}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
