'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Trash2, Search, FileText } from 'lucide-react';
import { api } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

type Prescription = {
  id: number; sale_id: number | null; patient_name: string | null; patient_phone: string | null;
  doctor_name: string | null; file_name: string; mime_type: string; file_size: number; notes: string | null; created_at: string;
};

export default function PrescriptionsPage() {
  const session = useSession();
  const isAdmin = session?.role === 'super_admin' || session?.role === 'pharmacy_admin';
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get(`/api/pharmacy/prescriptions?${q ? `q=${encodeURIComponent(q)}` : ''}`);
      setPrescriptions(data.prescriptions || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Choose a file first.'); return; }
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('patient_name', patientName);
      fd.append('patient_phone', patientPhone);
      fd.append('doctor_name', doctorName);
      fd.append('notes', notes);
      const res = await fetch('/api/pharmacy/prescriptions', { method: 'POST', body: fd, credentials: 'same-origin' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Upload failed.');
      setShowForm(false); setFile(null); setPatientName(''); setPatientPhone(''); setDoctorName(''); setNotes('');
      load();
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  }

  async function handleDelete(p: Prescription) {
    if (!confirm(`Delete prescription ${p.file_name}?`)) return;
    try { await api.delete(`/api/pharmacy/prescriptions/${p.id}`); load(); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Prescriptions</h1>
          <p className="text-sm text-gray-500 mt-1">Uploaded prescription images and documents.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="kmc-btn-accent flex items-center gap-2"><Plus size={16}/>Upload Prescription</button>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      {showForm && (
        <div className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Upload Prescription</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-crimson-600"><X size={18}/></button>
          </div>
          <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="kmc-label">File (image or PDF) *</label>
              <input type="file" accept="image/*,application/pdf" className="kmc-input" onChange={e => setFile(e.target.files?.[0] || null)} required/>
            </div>
            <div>
              <label className="kmc-label">Patient Name</label>
              <input className="kmc-input" value={patientName} onChange={e => setPatientName(e.target.value)}/>
            </div>
            <div>
              <label className="kmc-label">Patient Phone</label>
              <input className="kmc-input font-mono-num" value={patientPhone} onChange={e => setPatientPhone(e.target.value)}/>
            </div>
            <div>
              <label className="kmc-label">Doctor Name</label>
              <input className="kmc-input" value={doctorName} onChange={e => setDoctorName(e.target.value)}/>
            </div>
            <div>
              <label className="kmc-label">Notes</label>
              <input className="kmc-input" value={notes} onChange={e => setNotes(e.target.value)}/>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="kmc-btn-ghost">Cancel</button>
              <button type="submit" disabled={uploading} className="kmc-btn-primary">{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="kmc-card p-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="kmc-input pl-9" placeholder="Search by patient or phone..." value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      </div>

      <div className="kmc-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
              {['File','Patient','Phone','Doctor','Date','Actions'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && prescriptions.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No prescriptions uploaded.</td></tr>}
            {prescriptions.map(p => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3">
                  <a href={`/api/pharmacy/prescriptions/${p.id}/file`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-medium text-navy-900 hover:text-crimson-600">
                    <FileText size={14}/> {p.file_name}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-700">{p.patient_name || '—'}</td>
                <td className="px-4 py-3 font-mono-num text-gray-500 text-xs">{p.patient_phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.doctor_name || '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(p.created_at).toLocaleString('en-PK')}</td>
                <td className="px-4 py-3">
                  {isAdmin && (
                    <button onClick={() => handleDelete(p)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-crimson-50 hover:text-crimson-600"><Trash2 size={13}/></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
