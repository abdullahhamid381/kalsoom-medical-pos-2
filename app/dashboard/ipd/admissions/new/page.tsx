'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import PatientSearch, { Patient } from '@/components/PatientSearch';
import { UserPlus, Search } from 'lucide-react';

function nowStr() {
  const d = new Date();
  return { date: d.toISOString().slice(0,10), time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` };
}

export default function AdmitPatientPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patientMode, setPatientMode] = useState<'existing'|'new'>('existing');
  const [selectedPatient, setSelectedPatient] = useState<Patient|null>(null);
  const [newPt, setNewPt] = useState({ full_name:'', phone:'', age:'', gender:'Male', cnic:'', address:'' });
  const [roomId, setRoomId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const { date: initDate, time: initTime } = nowStr();
  const [admDate, setAdmDate] = useState(initDate);
  const [admTime, setAdmTime] = useState(initTime);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/api/ipd/rooms?available=1'), api.get('/api/doctors')])
      .then(([r, d]) => { setRooms(r.rooms||[]); setDoctors((d.doctors||[]).filter((x:any)=>x.active)); })
      .catch(() => {});
  }, []);

  const selectedRoom = rooms.find(r => r.id === Number(roomId));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (patientMode==='existing' && !selectedPatient) { setError('Select a patient.'); return; }
    if (patientMode==='new' && !newPt.full_name.trim()) { setError('Patient name is required.'); return; }
    if (!roomId) { setError('Select a room.'); return; }
    setSubmitting(true); setError('');
    try {
      let patient_id = selectedPatient?.id;
      if (patientMode === 'new') {
        const pd = await api.post('/api/patients', { ...newPt, age: newPt.age ? Number(newPt.age) : null });
        patient_id = pd.patient.id;
      }
      const data = await api.post('/api/ipd/admissions', { patient_id, room_id: Number(roomId), doctor_id: doctorId ? Number(doctorId) : null, diagnosis, notes, admission_date: admDate, admission_time: admTime });
      router.push(`/dashboard/ipd/admissions/${data.admission.id}?new=1`);
    } catch (e:any) { setError(e.message); setSubmitting(false); }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div><h1 className="font-display text-2xl font-bold text-navy-900">Admit Patient</h1><p className="text-sm text-gray-500 mt-1">Create a new in-patient admission record and assign a room.</p></div>
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Patient</h2>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              <button type="button" onClick={()=>setPatientMode('existing')} className={`px-3 py-1.5 flex items-center gap-1.5 ${patientMode==='existing'?'bg-navy-800 text-white':'bg-white text-gray-600'}`}><Search size={12}/>Existing</button>
              <button type="button" onClick={()=>{setPatientMode('new');setSelectedPatient(null);}} className={`px-3 py-1.5 flex items-center gap-1.5 ${patientMode==='new'?'bg-crimson-600 text-white':'bg-white text-gray-600'}`}><UserPlus size={12}/>New</button>
            </div>
          </div>
          {patientMode==='existing' ? <PatientSearch selected={selectedPatient} onSelect={setSelectedPatient}/> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="kmc-label">Full Name *</label><input className="kmc-input" value={newPt.full_name} onChange={e=>setNewPt({...newPt,full_name:e.target.value})} required/></div>
              <div><label className="kmc-label">Phone *</label><input className="kmc-input font-mono-num" value={newPt.phone} onChange={e=>setNewPt({...newPt,phone:e.target.value})}/></div>
              <div><label className="kmc-label">CNIC</label><input className="kmc-input font-mono-num" value={newPt.cnic} onChange={e=>setNewPt({...newPt,cnic:e.target.value})}/></div>
              <div><label className="kmc-label">Age</label><input type="number" min="0" className="kmc-input" value={newPt.age} onChange={e=>setNewPt({...newPt,age:e.target.value})}/></div>
              <div><label className="kmc-label">Gender</label><select className="kmc-input" value={newPt.gender} onChange={e=>setNewPt({...newPt,gender:e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select></div>
              <div><label className="kmc-label">Address</label><input className="kmc-input" value={newPt.address} onChange={e=>setNewPt({...newPt,address:e.target.value})}/></div>
            </div>
          )}
        </section>
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Admission Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="kmc-label">Room *</label>
              <select className="kmc-input" value={roomId} onChange={e=>setRoomId(e.target.value)} required>
                <option value="">{rooms.length===0?'No available rooms':'Select a room...'}</option>
                {rooms.map(r=><option key={r.id} value={r.id}>{r.room_no} — {r.room_type.replace('_',' ')} (Rs. {r.price_per_day}/day)</option>)}
              </select>
              {selectedRoom && <p className="text-xs text-gray-400 mt-1">Floor: {selectedRoom.floor||'—'} · {selectedRoom.description||''}</p>}
            </div>
            <div>
              <label className="kmc-label">Assigned Doctor</label>
              <select className="kmc-input" value={doctorId} onChange={e=>setDoctorId(e.target.value)}>
                <option value="">Select doctor (optional)</option>
                {doctors.map(d=><option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>)}
              </select>
            </div>
            <div><label className="kmc-label">Admission Date</label><input type="date" className="kmc-input" value={admDate} onChange={e=>setAdmDate(e.target.value)}/></div>
            <div><label className="kmc-label">Admission Time</label><input type="time" className="kmc-input" value={admTime} onChange={e=>setAdmTime(e.target.value)}/></div>
            <div className="sm:col-span-2"><label className="kmc-label">Diagnosis / Chief Complaint</label><input className="kmc-input" placeholder="e.g. Fever, Fracture, Post-surgical..." value={diagnosis} onChange={e=>setDiagnosis(e.target.value)}/></div>
            <div className="sm:col-span-2"><label className="kmc-label">Notes</label><textarea className="kmc-input" rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></div>
          </div>
        </section>
        <div className="flex justify-end"><button type="submit" disabled={submitting} className="kmc-btn-accent">{submitting?'Admitting...':'Admit Patient'}</button></div>
      </form>
    </div>
  );
}
