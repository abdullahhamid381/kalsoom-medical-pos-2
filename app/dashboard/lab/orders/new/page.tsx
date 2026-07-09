'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Plus, Trash2, Banknote, Smartphone, Wallet, Landmark, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api-client';
import PatientSearch, { Patient } from '@/components/PatientSearch';
import ReferringDoctorSearch, { ReferringDoctor } from '@/components/ReferringDoctorSearch';

type Test = { id: number; name: string; category: string | null; price: number; turnaround: string; };
type Panel = { id: number; name: string; category: string | null; price: number; turnaround: string; member_tests: { id: number; name: string }[] };

const PAY_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'jazzcash', label: 'JazzCash', icon: Smartphone },
  { value: 'easypaisa', label: 'EasyPaisa', icon: Wallet },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Landmark },
  { value: 'card', label: 'Card', icon: CreditCard },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'stat', label: 'STAT' },
];

export default function NewLabOrderPage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-400 py-16">Loading...</div>}>
      <NewLabOrderInner />
    </Suspense>
  );
}

function NewLabOrderInner() {
  const router = useRouter();
  const search = useSearchParams();
  const appointmentId = search.get('appointment_id');
  const admissionId = search.get('admission_id');
  const [linkedVisit, setLinkedVisit] = useState<{ type: 'appointment' | 'admission'; label: string } | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [filtered, setFiltered] = useState<Test[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [selectedTests, setSelectedTests] = useState<{ test: Test; price: number }[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [panelSearch, setPanelSearch] = useState('');
  const [filteredPanels, setFilteredPanels] = useState<Panel[]>([]);
  const [showPanelDrop, setShowPanelDrop] = useState(false);
  const [selectedPanels, setSelectedPanels] = useState<{ panel: Panel; price: number }[]>([]);
  const [patientMode, setPatientMode] = useState<'existing' | 'new'>('existing');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [newPt, setNewPt] = useState({ name: '', phone: '', age: '', gender: 'Other' });
  const [referringDoctor, setReferringDoctor] = useState<ReferringDoctor | null>(null);
  const [priority, setPriority] = useState('routine');
  const [payMethod, setPayMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [touchedPaid, setTouchedPaid] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showInsurance, setShowInsurance] = useState(false);
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [tpaReference, setTpaReference] = useState('');
  const [collectionMode, setCollectionMode] = useState<'lab' | 'home'>('lab');
  const [homeAddress, setHomeAddress] = useState('');

  useEffect(() => {
    api.get('/api/lab/tests').then(d => setTests(d.tests || [])).catch(() => {});
    api.get('/api/lab/panels').then(d => setPanels(d.panels || [])).catch(() => {});
  }, []);

  // Pre-fill + lock the patient when arriving from an appointment/admission's "Order Lab Test" button.
  useEffect(() => {
    if (appointmentId) {
      api.get(`/api/appointments/${appointmentId}`).then(d => {
        const a = d.appointment || d;
        setSelectedPatient({ id: a.patient_id, full_name: a.patient_name, phone: a.patient_phone });
        setPatientMode('existing');
        setLinkedVisit({ type: 'appointment', label: a.appointment_no });
      }).catch(() => {});
    } else if (admissionId) {
      api.get(`/api/ipd/admissions/${admissionId}`).then(d => {
        const a = d.admission || d;
        setSelectedPatient({ id: a.patient_id, full_name: a.patient_name, phone: a.patient_phone, age: a.patient_age, gender: a.patient_gender });
        setPatientMode('existing');
        setLinkedVisit({ type: 'admission', label: a.admission_no });
      }).catch(() => {});
    }
  }, [appointmentId, admissionId]);

  useEffect(() => {
    if (!testSearch.trim()) { setFiltered([]); return; }
    const q = testSearch.toLowerCase();
    setFiltered(tests.filter(t => t.name.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q)).slice(0, 8));
  }, [testSearch, tests]);

  useEffect(() => {
    if (!panelSearch.trim()) { setFilteredPanels([]); return; }
    const q = panelSearch.toLowerCase();
    setFilteredPanels(panels.filter(p => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)).slice(0, 8));
  }, [panelSearch, panels]);

  function addTest(t: Test) {
    if (selectedTests.find(i => i.test.id === t.id)) return;
    setSelectedTests(prev => [...prev, { test: t, price: t.price }]);
    setTestSearch(''); setShowDrop(false);
  }
  function removeTest(id: number) { setSelectedTests(prev => prev.filter(i => i.test.id !== id)); }
  function updatePrice(id: number, price: number) { setSelectedTests(prev => prev.map(i => i.test.id === id ? { ...i, price } : i)); }

  function addPanel(p: Panel) {
    if (selectedPanels.find(i => i.panel.id === p.id)) return;
    setSelectedPanels(prev => [...prev, { panel: p, price: p.price }]);
    setPanelSearch(''); setShowPanelDrop(false);
  }
  function removePanel(id: number) { setSelectedPanels(prev => prev.filter(i => i.panel.id !== id)); }
  function updatePanelPrice(id: number, price: number) { setSelectedPanels(prev => prev.map(i => i.panel.id === id ? { ...i, price } : i)); }

  const subtotal = selectedTests.reduce((s, i) => s + i.price, 0) + selectedPanels.reduce((s, i) => s + i.price, 0);
  const total = Math.max(subtotal - discount, 0);
  const payStatus = paidAmount >= total && total > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
  useEffect(() => { if (!touchedPaid) setPaidAmount(total); }, [total, touchedPaid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedTests.length === 0 && selectedPanels.length === 0) { setError('Select at least one test or panel.'); return; }
    if (patientMode === 'existing' && !selectedPatient) { setError('Search and select a patient.'); return; }
    if (patientMode === 'new' && !newPt.name.trim()) { setError('Patient name is required.'); return; }
    if (collectionMode === 'home' && !homeAddress.trim()) { setError('Home address is required for home collection.'); return; }
    setSubmitting(true); setError('');
    try {
      const payload: any = {
        tests: selectedTests.map(i => ({ id: i.test.id, price: i.price })),
        panels: selectedPanels.map(i => ({ id: i.panel.id, price: i.price })),
        payment_method: payMethod, discount, paid_amount: paidAmount,
        referring_doctor_id: referringDoctor?.id, notes, priority,
        appointment_id: linkedVisit?.type === 'appointment' ? appointmentId : undefined,
        admission_id: linkedVisit?.type === 'admission' ? admissionId : undefined,
        insurance_provider: insuranceProvider || undefined,
        tpa_reference: tpaReference || undefined,
        collection_mode: collectionMode,
        home_address: collectionMode === 'home' ? homeAddress : undefined,
      };
      if (patientMode === 'existing' && selectedPatient) { payload.patient_id = selectedPatient.id; }
      else { payload.patient_name = newPt.name; payload.patient_phone = newPt.phone; payload.patient_age = newPt.age ? Number(newPt.age) : null; payload.patient_gender = newPt.gender; }
      const data = await api.post('/api/lab/orders', payload);
      router.push(`/dashboard/lab/orders/${data.order.id}?new=1`);
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">New Lab Order</h1>
        <p className="text-sm text-gray-500 mt-1">Select tests, enter patient details and record payment.</p>
      </div>
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-5">
        {linkedVisit && (
          <div className="kmc-card p-3 bg-sky-50 border-sky-200 text-sky-800 text-sm font-medium">
            Linked to {linkedVisit.type === 'appointment' ? 'Appointment' : 'Admission'} #{linkedVisit.label} — patient locked from that visit.
          </div>
        )}

        {/* Patient */}
        <section className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Patient</h2>
            {!linkedVisit && (
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                <button type="button" onClick={() => setPatientMode('existing')} className={`px-3 py-1.5 ${patientMode === 'existing' ? 'bg-navy-800 text-white' : 'bg-white text-gray-600'}`}>Existing</button>
                <button type="button" onClick={() => { setPatientMode('new'); setSelectedPatient(null); }} className={`px-3 py-1.5 ${patientMode === 'new' ? 'bg-crimson-600 text-white' : 'bg-white text-gray-600'}`}>New Patient</button>
              </div>
            )}
          </div>
          {patientMode === 'existing' ? (
            <PatientSearch selected={selectedPatient} onSelect={linkedVisit ? () => {} : setSelectedPatient} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="kmc-label">Full Name *</label><input className="kmc-input" value={newPt.name} onChange={e => setNewPt({ ...newPt, name: e.target.value })} required /></div>
              <div><label className="kmc-label">Phone</label><input className="kmc-input font-mono-num" placeholder="03xx-xxxxxxx" value={newPt.phone} onChange={e => setNewPt({ ...newPt, phone: e.target.value })} /></div>
              <div><label className="kmc-label">Age</label><input type="number" min="0" className="kmc-input" value={newPt.age} onChange={e => setNewPt({ ...newPt, age: e.target.value })} /></div>
              <div><label className="kmc-label">Gender</label><select className="kmc-input" value={newPt.gender} onChange={e => setNewPt({ ...newPt, gender: e.target.value })}><option>Male</option><option>Female</option><option>Other</option></select></div>
            </div>
          )}
          <div className="mt-4">
            <label className="kmc-label">Referring Doctor (optional)</label>
            <ReferringDoctorSearch selected={referringDoctor} onSelect={setReferringDoctor} />
          </div>
        </section>

        {/* Priority + collection mode */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">Priority &amp; Collection</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="kmc-label">Priority</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                {PRIORITIES.map(p => (
                  <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                    className={`flex-1 px-3 py-2 ${priority === p.value ? (p.value === 'stat' ? 'bg-crimson-600 text-white' : p.value === 'urgent' ? 'bg-amber-500 text-white' : 'bg-navy-800 text-white') : 'bg-white text-gray-600'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="kmc-label">Collection Mode</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                <button type="button" onClick={() => setCollectionMode('lab')} className={`flex-1 px-3 py-2 ${collectionMode === 'lab' ? 'bg-navy-800 text-white' : 'bg-white text-gray-600'}`}>At Lab</button>
                <button type="button" onClick={() => setCollectionMode('home')} className={`flex-1 px-3 py-2 ${collectionMode === 'home' ? 'bg-navy-800 text-white' : 'bg-white text-gray-600'}`}>Home Collection</button>
              </div>
            </div>
          </div>
          {collectionMode === 'home' && (
            <div className="mt-4">
              <label className="kmc-label">Home Address *</label>
              <input className="kmc-input" placeholder="Full address for sample pickup..." value={homeAddress} onChange={e => setHomeAddress(e.target.value)} required />
            </div>
          )}
        </section>

        {/* Insurance / TPA */}
        <section className="kmc-card p-5">
          <button type="button" onClick={() => setShowInsurance(!showInsurance)} className="w-full flex items-center justify-between">
            <h2 className="font-display font-semibold text-navy-900">Insurance / TPA (optional)</h2>
            {showInsurance ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>
          {showInsurance && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div><label className="kmc-label">Insurance Provider</label><input className="kmc-input" placeholder="e.g. Jubilee, EFU" value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)} /></div>
              <div><label className="kmc-label">TPA Reference No.</label><input className="kmc-input" value={tpaReference} onChange={e => setTpaReference(e.target.value)} /></div>
            </div>
          )}
        </section>

        {/* Panels */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">Select Panels (Bundles)</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="kmc-input pl-9" placeholder="Search panel by name or category (e.g. CBC, LFT)..." value={panelSearch}
              onChange={e => { setPanelSearch(e.target.value); setShowPanelDrop(true); }}
              onFocus={() => setShowPanelDrop(true)} onBlur={() => setTimeout(() => setShowPanelDrop(false), 150)} />
            {showPanelDrop && filteredPanels.length > 0 && (
              <div className="absolute z-30 mt-1 w-full kmc-card shadow-pop max-h-60 overflow-y-auto">
                {filteredPanels.map(p => (
                  <button key={p.id} type="button" onMouseDown={() => addPanel(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-mist border-b border-gray-50 last:border-0 flex justify-between">
                    <div>
                      <p className="font-medium text-navy-900 text-sm">{p.name}</p>
                      <p className="text-xs text-gray-400">{(p.member_tests || []).map(t => t.name).join(', ')}</p>
                    </div>
                    <span className="text-xs font-mono-num font-semibold text-navy-800 self-center">Rs. {p.price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedPanels.length > 0 && (
            <div className="mt-4 space-y-2">
              {selectedPanels.map(item => (
                <div key={item.panel.id} className="flex items-center justify-between bg-mist rounded-xl px-4 py-3">
                  <div>
                    <p className="font-medium text-navy-900 text-sm">{item.panel.name}</p>
                    <p className="text-xs text-gray-400">{(item.panel.member_tests || []).map(t => t.name).join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Rs.</span>
                      <input type="number" min="0" className="w-24 kmc-input text-sm font-mono-num py-1.5" value={item.price} onChange={e => updatePanelPrice(item.panel.id, Number(e.target.value))} />
                    </div>
                    <button type="button" onClick={() => removePanel(item.panel.id)} className="text-gray-300 hover:text-crimson-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Tests */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">Select Ad-hoc Tests</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="kmc-input pl-9" placeholder="Search test by name or category..." value={testSearch}
              onChange={e => { setTestSearch(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)} onBlur={() => setTimeout(() => setShowDrop(false), 150)} />
            {showDrop && filtered.length > 0 && (
              <div className="absolute z-30 mt-1 w-full kmc-card shadow-pop max-h-60 overflow-y-auto">
                {filtered.map(t => (
                  <button key={t.id} type="button" onMouseDown={() => addTest(t)}
                    className="w-full text-left px-4 py-2.5 hover:bg-mist border-b border-gray-50 last:border-0 flex justify-between">
                    <div><p className="font-medium text-navy-900 text-sm">{t.name}</p><p className="text-xs text-gray-400">{t.category || 'General'} — {t.turnaround}</p></div>
                    <span className="text-xs font-mono-num font-semibold text-navy-800 self-center">Rs. {t.price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedTests.length > 0 ? (
            <div className="mt-4 space-y-2">
              {selectedTests.map(item => (
                <div key={item.test.id} className="flex items-center justify-between bg-mist rounded-xl px-4 py-3">
                  <div><p className="font-medium text-navy-900 text-sm">{item.test.name}</p><p className="text-xs text-gray-400">{item.test.category || 'General'}</p></div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Rs.</span>
                      <input type="number" min="0" className="w-24 kmc-input text-sm font-mono-num py-1.5" value={item.price} onChange={e => updatePrice(item.test.id, Number(e.target.value))} />
                    </div>
                    <button type="button" onClick={() => removeTest(item.test.id)} className="text-gray-300 hover:text-crimson-600"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-center text-gray-400 text-sm py-6 border-2 border-dashed border-gray-100 rounded-xl">Search and add lab tests above</div>
          )}
        </section>

        {/* Payment */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Payment</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {PAY_METHODS.map(m => (
              <button key={m.value} type="button" onClick={() => setPayMethod(m.value)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors ${payMethod === m.value ? 'border-crimson-500 bg-crimson-50 text-crimson-700' : 'border-gray-200 text-gray-600 hover:bg-mist'}`}>
                <m.icon size={18} />{m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="kmc-label">Subtotal</label><input readOnly className="kmc-input font-mono-num bg-mist" value={`Rs. ${subtotal}`} /></div>
            <div><label className="kmc-label">Discount (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></div>
            <div><label className="kmc-label">Paid Amount (Rs.)</label><input type="number" min="0" className="kmc-input font-mono-num" value={paidAmount} onChange={e => { setTouchedPaid(true); setPaidAmount(Number(e.target.value)); }} /></div>
          </div>
          <div className="mt-4 flex items-center justify-between bg-mist rounded-xl px-4 py-3">
            <div className="text-sm text-gray-600">Total: <span className="font-mono-num font-bold text-navy-900 text-lg">Rs. {total}</span></div>
            <span className={`kmc-badge ${payStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : payStatus === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'}`}>{payStatus}</span>
          </div>
          <div className="mt-3"><label className="kmc-label">Notes</label><input className="kmc-input" placeholder="Optional remarks..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </section>
        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="kmc-btn-accent">{submitting ? 'Booking...' : 'Confirm Order'}</button>
        </div>
      </form>
    </div>
  );
}
