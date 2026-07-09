'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import PatientSearch, { Patient } from '@/components/PatientSearch';
import { Search, UserPlus, Banknote, Smartphone, Wallet, Landmark, CreditCard } from 'lucide-react';

const PAY = [
  { value:'cash',label:'Cash',icon:Banknote },{ value:'jazzcash',label:'JazzCash',icon:Smartphone },
  { value:'easypaisa',label:'EasyPaisa',icon:Wallet },{ value:'bank_transfer',label:'Bank',icon:Landmark },{ value:'card',label:'Card',icon:CreditCard }
];

export default function NewSurgeryPage() {
  const router = useRouter();
  const [types, setTypes] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [patientMode, setPatientMode] = useState<'existing'|'new'>('existing');
  const [selectedPatient, setSelectedPatient] = useState<Patient|null>(null);
  const [newPt, setNewPt] = useState({ full_name:'', phone:'', age:'', gender:'Male' });
  const [form, setForm] = useState({ surgery_type_id:'', surgeon_id:'', admission_id:'', anesthetist:'', surgery_date: new Date().toISOString().slice(0,10), surgery_time:'', duration_hrs:'1', theatre_no:'', diagnosis:'', procedure_notes:'', status:'scheduled' });
  const [fees, setFees] = useState({ surgery_fee:'', anesthesia_fee:'0', theatre_fee:'0', medicine_cost:'0', other_charges:'0', discount:'0', paid_amount:'0', payment_method:'cash' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/api/surgery/types'), api.get('/api/doctors')])
      .then(([t,d]) => { setTypes(t.types||[]); setDoctors((d.doctors||[]).filter((x:any)=>x.active)); });
  }, []);

  useEffect(() => {
    if (selectedPatient || (patientMode==='new')) {
      const pid = selectedPatient?.id;
      if (pid) api.get(`/api/ipd/admissions?patient_id=${pid}&status=admitted`).then(d=>setAdmissions(d.admissions||[])).catch(()=>{});
    }
  }, [selectedPatient, patientMode]);

  const selectedType = types.find(t => t.id === Number(form.surgery_type_id));
  useEffect(() => {
    if (selectedType && !fees.surgery_fee) setFees(f => ({ ...f, surgery_fee: String(selectedType.base_price) }));
  }, [selectedType]);

  const total = ['surgery_fee','anesthesia_fee','theatre_fee','medicine_cost','other_charges'].reduce((s,k) => s + Number((fees as any)[k]||0), 0);
  const net = Math.max(total - Number(fees.discount||0), 0);
  const payStatus = Number(fees.paid_amount) >= net && net > 0 ? 'paid' : Number(fees.paid_amount) > 0 ? 'partial' : 'unpaid';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (patientMode==='existing' && !selectedPatient) { setError('Select a patient.'); return; }
    if (patientMode==='new' && !newPt.full_name.trim()) { setError('Patient name required.'); return; }
    if (!form.surgery_type_id) { setError('Select a surgery type.'); return; }
    setSubmitting(true); setError('');
    try {
      let patient_id = selectedPatient?.id;
      if (patientMode==='new') { const pd = await api.post('/api/patients', { ...newPt, age: newPt.age ? Number(newPt.age) : null }); patient_id = pd.patient.id; }
      const data = await api.post('/api/surgery/records', { ...form, ...fees, patient_id, surgery_fee: Number(fees.surgery_fee||0), anesthesia_fee: Number(fees.anesthesia_fee||0), theatre_fee: Number(fees.theatre_fee||0), medicine_cost: Number(fees.medicine_cost||0), other_charges: Number(fees.other_charges||0), discount: Number(fees.discount||0), paid_amount: Number(fees.paid_amount||0) });
      router.push(`/dashboard/surgery/records/${data.record.id}?new=1`);
    } catch (e:any) { setError(e.message); setSubmitting(false); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div><h1 className="font-display text-2xl font-bold text-navy-900">New Surgery Record</h1><p className="text-sm text-gray-500 mt-1">Record a surgery, assign surgeon and document expenses.</p></div>
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Patient */}
        <section className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Patient</h2>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              <button type="button" onClick={()=>setPatientMode('existing')} className={`px-3 py-1.5 flex items-center gap-1.5 ${patientMode==='existing'?'bg-navy-800 text-white':'bg-white text-gray-600'}`}><Search size={12}/>Existing</button>
              <button type="button" onClick={()=>{setPatientMode('new');setSelectedPatient(null);}} className={`px-3 py-1.5 flex items-center gap-1.5 ${patientMode==='new'?'bg-crimson-600 text-white':'bg-white text-gray-600'}`}><UserPlus size={12}/>New</button>
            </div>
          </div>
          {patientMode==='existing' ? <PatientSearch selected={selectedPatient} onSelect={setSelectedPatient}/> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="kmc-label">Full Name *</label><input className="kmc-input" value={newPt.full_name} onChange={e=>setNewPt({...newPt,full_name:e.target.value})} required/></div>
              <div><label className="kmc-label">Phone</label><input className="kmc-input font-mono-num" value={newPt.phone} onChange={e=>setNewPt({...newPt,phone:e.target.value})}/></div>
              <div><label className="kmc-label">Age</label><input type="number" min="0" className="kmc-input" value={newPt.age} onChange={e=>setNewPt({...newPt,age:e.target.value})}/></div>
              <div><label className="kmc-label">Gender</label><select className="kmc-input" value={newPt.gender} onChange={e=>setNewPt({...newPt,gender:e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select></div>
            </div>
          )}
        </section>
        {/* Surgery details */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Surgery Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="kmc-label">Surgery Type *</label>
              <select className="kmc-input" value={form.surgery_type_id} onChange={e=>setForm({...form,surgery_type_id:e.target.value})} required>
                <option value="">Select surgery type...</option>
                {types.map(t=><option key={t.id} value={t.id}>{t.name}{t.category?` — ${t.category}`:''} (Rs.{t.base_price})</option>)}
              </select>
            </div>
            <div><label className="kmc-label">Surgeon</label>
              <select className="kmc-input" value={form.surgeon_id} onChange={e=>setForm({...form,surgeon_id:e.target.value})}>
                <option value="">Select surgeon (optional)</option>
                {doctors.map(d=><option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}
              </select>
            </div>
            <div><label className="kmc-label">Surgery Date</label><input type="date" className="kmc-input" value={form.surgery_date} onChange={e=>setForm({...form,surgery_date:e.target.value})}/></div>
            <div><label className="kmc-label">Surgery Time</label><input type="time" className="kmc-input" value={form.surgery_time} onChange={e=>setForm({...form,surgery_time:e.target.value})}/></div>
            <div><label className="kmc-label">Theatre No.</label><input className="kmc-input" placeholder="e.g. OT-1, OT-2" value={form.theatre_no} onChange={e=>setForm({...form,theatre_no:e.target.value})}/></div>
            <div><label className="kmc-label">Anesthetist</label><input className="kmc-input" placeholder="Name" value={form.anesthetist} onChange={e=>setForm({...form,anesthetist:e.target.value})}/></div>
            <div><label className="kmc-label">Duration (hrs)</label><input type="number" min="0.5" step="0.5" className="kmc-input font-mono-num" value={form.duration_hrs} onChange={e=>setForm({...form,duration_hrs:e.target.value})}/></div>
            <div><label className="kmc-label">Status</label>
              <select className="kmc-input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                <option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div><label className="kmc-label">Link to Admission (optional)</label>
              <select className="kmc-input" value={form.admission_id} onChange={e=>setForm({...form,admission_id:e.target.value})}>
                <option value="">No admission link</option>
                {admissions.map(a=><option key={a.id} value={a.id}>{a.admission_no} — Room {a.room_no}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className="kmc-label">Diagnosis</label><input className="kmc-input" value={form.diagnosis} onChange={e=>setForm({...form,diagnosis:e.target.value})}/></div>
            <div className="sm:col-span-2"><label className="kmc-label">Procedure Notes</label><textarea className="kmc-input" rows={2} value={form.procedure_notes} onChange={e=>setForm({...form,procedure_notes:e.target.value})}/></div>
          </div>
        </section>
        {/* Fees */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Fees & Payment</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div><label className="kmc-label">Surgeon Fee (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={fees.surgery_fee} onChange={e=>setFees({...fees,surgery_fee:e.target.value})}/></div>
            <div><label className="kmc-label">Anaesthesia Fee</label><input type="number" min="0" className="kmc-input font-mono-num" value={fees.anesthesia_fee} onChange={e=>setFees({...fees,anesthesia_fee:e.target.value})}/></div>
            <div><label className="kmc-label">Theatre Fee</label><input type="number" min="0" className="kmc-input font-mono-num" value={fees.theatre_fee} onChange={e=>setFees({...fees,theatre_fee:e.target.value})}/></div>
            <div><label className="kmc-label">Medicine Cost</label><input type="number" min="0" className="kmc-input font-mono-num" value={fees.medicine_cost} onChange={e=>setFees({...fees,medicine_cost:e.target.value})}/></div>
            <div><label className="kmc-label">Other Charges</label><input type="number" min="0" className="kmc-input font-mono-num" value={fees.other_charges} onChange={e=>setFees({...fees,other_charges:e.target.value})}/></div>
            <div><label className="kmc-label">Discount (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={fees.discount} onChange={e=>setFees({...fees,discount:e.target.value})}/></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
            {PAY.map(m=>(
              <button key={m.value} type="button" onClick={()=>setFees({...fees,payment_method:m.value})}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold ${fees.payment_method===m.value?'border-crimson-500 bg-crimson-50 text-crimson-700':'border-gray-200 text-gray-600 hover:bg-mist'}`}>
                <m.icon size={16}/>{m.label}
              </button>
            ))}
          </div>
          <div className="mt-4"><label className="kmc-label">Paid Amount (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num max-w-xs" value={fees.paid_amount} onChange={e=>setFees({...fees,paid_amount:e.target.value})}/></div>
          <div className="mt-4 flex items-center justify-between bg-mist rounded-xl px-4 py-3">
            <div className="text-sm text-gray-600">Total: <span className="font-mono-num font-bold text-navy-900 text-lg">Rs.{total}</span><span className="ml-3 text-gray-400 text-xs">Net: Rs.{net}</span></div>
            <span className={`kmc-badge ${payStatus==='paid'?'bg-emerald-100 text-emerald-800':payStatus==='partial'?'bg-amber-100 text-amber-800':'bg-crimson-100 text-crimson-800'}`}>{payStatus}</span>
          </div>
        </section>
        <div className="flex justify-end"><button type="submit" disabled={submitting} className="kmc-btn-accent">{submitting?'Saving...':'Save Surgery Record'}</button></div>
      </form>
    </div>
  );
}
