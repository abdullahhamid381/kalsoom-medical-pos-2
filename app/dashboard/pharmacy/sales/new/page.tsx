'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Search, Banknote, Smartphone, Wallet, Landmark, CreditCard, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api-client';
import PatientSearch, { Patient } from '@/components/PatientSearch';

type Medicine = { id: number; name: string; unit: string; sale_price: number; stock_qty: number; prescription_required?: number; };
type Batch = { id: number; batch_no: string; expiry_date: string; qty: number; };
type CartItem = { medicine: Medicine; qty: number; unit_price: number; batch_id: number | null; batches: Batch[]; };

const PAY_METHODS = [
  { value:'cash', label:'Cash', icon: Banknote },
  { value:'jazzcash', label:'JazzCash', icon: Smartphone },
  { value:'easypaisa', label:'EasyPaisa', icon: Wallet },
  { value:'bank_transfer', label:'Bank Transfer', icon: Landmark },
  { value:'card', label:'Card', icon: CreditCard },
];

export default function NewSalePage() {
  const router = useRouter();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medSearch, setMedSearch] = useState('');
  const [filtered, setFiltered] = useState<Medicine[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [patientMode, setPatientMode] = useState<'existing'|'walkin'>('walkin');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [walkName, setWalkName] = useState('');
  const [walkPhone, setWalkPhone] = useState('');

  const [payMethod, setPayMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [touchedPaid, setTouchedPaid] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [creditBalance, setCreditBalance] = useState(0);
  const [redeemCredit, setRedeemCredit] = useState(0);

  const resolvedPhone = patientMode === 'existing' ? (selectedPatient?.phone || '') : walkPhone;

  useEffect(() => {
    if (!resolvedPhone.trim()) { setCreditBalance(0); setRedeemCredit(0); return; }
    const t = setTimeout(() => {
      api.get(`/api/pharmacy/customer-credit?phone=${encodeURIComponent(resolvedPhone.trim())}`)
        .then(d => setCreditBalance(Math.max(d.balance || 0, 0)))
        .catch(() => setCreditBalance(0));
    }, 300);
    return () => clearTimeout(t);
  }, [resolvedPhone]);

  useEffect(() => {
    api.get('/api/pharmacy/medicines').then(d => setMedicines(d.medicines || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!medSearch.trim()) { setFiltered([]); return; }
    const q = medSearch.toLowerCase();
    setFiltered(medicines.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8));
  }, [medSearch, medicines]);

  function addToCart(med: Medicine) {
    setCart(prev => {
      const existing = prev.find(i => i.medicine.id === med.id);
      if (existing) return prev.map(i => i.medicine.id === med.id ? {...i, qty: i.qty + 1} : i);
      return [...prev, { medicine: med, qty: 1, unit_price: med.sale_price, batch_id: null, batches: [] }];
    });
    setMedSearch(''); setShowDrop(false);
    api.get(`/api/pharmacy/batches?medicine_id=${med.id}`).then(d => {
      const batches: Batch[] = d.batches || [];
      setCart(prev => prev.map(i => i.medicine.id === med.id
        ? { ...i, batches, batch_id: i.batch_id ?? (batches[0]?.id ?? null) }
        : i));
    }).catch(() => {});
  }

  function updateCart(idx: number, field: 'qty'|'unit_price'|'batch_id', val: number | null) {
    setCart(prev => prev.map((i, n) => n === idx ? {...i, [field]: val} : i));
  }

  function removeFromCart(idx: number) { setCart(prev => prev.filter((_, n) => n !== idx)); }

  const subtotal = cart.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const total = Math.max(subtotal - discount, 0);
  const effectiveRedeem = Math.min(redeemCredit, creditBalance, total);
  const payStatus = (paidAmount + effectiveRedeem) >= total && total > 0 ? 'paid' : (paidAmount + effectiveRedeem) > 0 ? 'partial' : 'unpaid';

  useEffect(() => { if (!touchedPaid) setPaidAmount(Math.max(total - effectiveRedeem, 0)); }, [total, effectiveRedeem, touchedPaid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0) { setError('Add at least one medicine.'); return; }
    setSubmitting(true); setError('');
    try {
      const payload: any = {
        items: cart.map(i => ({ medicine_id: i.medicine.id, qty: i.qty, unit_price: i.unit_price, batch_id: i.batch_id })),
        payment_method: payMethod, discount, paid_amount: paidAmount, notes,
        redeem_credit_amount: effectiveRedeem,
      };
      if (patientMode === 'existing' && selectedPatient) {
        payload.patient_id = selectedPatient.id;
      } else {
        payload.patient_name = walkName || 'Walk-in Customer';
        payload.patient_phone = walkPhone || null;
      }
      const data = await api.post('/api/pharmacy/sales', payload);
      router.push(`/dashboard/pharmacy/sales/${data.sale.id}?new=1`);
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">New Pharmacy Sale</h1>
        <p className="text-sm text-gray-500 mt-1">Add medicines, select patient, record payment.</p>
      </div>
      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Patient */}
        <section className="kmc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-navy-900">Patient</h2>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              <button type="button" onClick={() => setPatientMode('walkin')} className={`px-3 py-1.5 ${patientMode==='walkin' ? 'bg-navy-800 text-white' : 'bg-white text-gray-600'}`}>Walk-in</button>
              <button type="button" onClick={() => setPatientMode('existing')} className={`px-3 py-1.5 ${patientMode==='existing' ? 'bg-crimson-600 text-white' : 'bg-white text-gray-600'}`}>Existing Patient</button>
            </div>
          </div>
          {patientMode === 'existing' ? (
            <PatientSearch selected={selectedPatient} onSelect={setSelectedPatient}/>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="kmc-label">Customer Name</label><input className="kmc-input" placeholder="Walk-in Customer" value={walkName} onChange={e => setWalkName(e.target.value)}/></div>
              <div><label className="kmc-label">Phone (for WhatsApp)</label><input className="kmc-input font-mono-num" placeholder="03xx-xxxxxxx" value={walkPhone} onChange={e => setWalkPhone(e.target.value)}/></div>
            </div>
          )}
        </section>

        {/* Medicine search + cart */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-3">Medicines</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input className="kmc-input pl-9" placeholder="Search medicine by name..." value={medSearch}
              onChange={e => { setMedSearch(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)} onBlur={() => setTimeout(() => setShowDrop(false), 150)}/>
            {showDrop && filtered.length > 0 && (
              <div className="absolute z-30 mt-1 w-full kmc-card shadow-pop max-h-56 overflow-y-auto">
                {filtered.map(m => (
                  <button key={m.id} type="button" onMouseDown={() => addToCart(m)}
                    className="w-full text-left px-4 py-2.5 hover:bg-mist border-b border-gray-50 last:border-0 flex justify-between">
                    <span className="font-medium text-navy-900 text-sm">{m.name} <span className="text-gray-400 text-xs">({m.unit})</span></span>
                    <span className="text-xs text-gray-500">Stock: {m.stock_qty} | Rs. {m.sale_price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                    <th className="pb-2">Medicine</th><th className="pb-2">Batch</th><th className="pb-2">Qty</th><th className="pb-2">Unit Price</th><th className="pb-2 text-right">Total</th><th/>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-navy-900">
                          {item.medicine.name}
                          {item.medicine.prescription_required ? <span className="kmc-badge bg-navy-50 text-navy-700 ml-1.5 align-middle">Rx</span> : null}
                        </p>
                        <p className="text-xs text-gray-400">{item.medicine.unit} | stock: {item.medicine.stock_qty}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <select className="kmc-input w-36 text-sm" value={item.batch_id ?? ''}
                          onChange={e => updateCart(idx, 'batch_id', e.target.value ? Number(e.target.value) : null)}>
                          <option value="">No batch</option>
                          {item.batches.map(b => (
                            <option key={b.id} value={b.id}>{b.batch_no} (exp {b.expiry_date}, {b.qty})</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 pr-3">
                        <input type="number" min="0.5" step="0.5" max={item.medicine.stock_qty} className="kmc-input w-20 font-mono-num text-sm"
                          value={item.qty} onChange={e => updateCart(idx, 'qty', Number(e.target.value))}/>
                      </td>
                      <td className="py-2.5 pr-3">
                        <input type="number" min="0" className="kmc-input w-28 font-mono-num text-sm"
                          value={item.unit_price} onChange={e => updateCart(idx, 'unit_price', Number(e.target.value))}/>
                      </td>
                      <td className="py-2.5 font-mono-num font-semibold text-navy-900 text-right pr-3">
                        Rs. {(item.qty * item.unit_price).toFixed(0)}
                      </td>
                      <td className="py-2.5">
                        <button type="button" onClick={() => removeFromCart(idx)} className="text-gray-300 hover:text-crimson-600"><Trash2 size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cart.length === 0 && (
            <div className="mt-4 text-center text-gray-400 text-sm py-6 border-2 border-dashed border-gray-100 rounded-xl">
              Search and add medicines above
            </div>
          )}
          {cart.some(i => i.medicine.prescription_required) && (
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14}/> One or more medicines in this cart require a prescription. You can attach one after completing the sale.
            </div>
          )}
        </section>

        {/* Payment */}
        <section className="kmc-card p-5">
          <h2 className="font-display font-semibold text-navy-900 mb-4">Payment</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {PAY_METHODS.map(m => (
              <button key={m.value} type="button" onClick={() => setPayMethod(m.value)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors ${payMethod===m.value ? 'border-crimson-500 bg-crimson-50 text-crimson-700' : 'border-gray-200 text-gray-600 hover:bg-mist'}`}>
                <m.icon size={18}/>{m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="kmc-label">Subtotal</label>
              <input readOnly className="kmc-input font-mono-num bg-mist" value={`Rs. ${subtotal.toFixed(0)}`}/>
            </div>
            <div>
              <label className="kmc-label">Discount (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={discount} onChange={e => setDiscount(Number(e.target.value))}/>
            </div>
            <div>
              <label className="kmc-label">Paid Amount (Rs.)</label>
              <input type="number" min="0" className="kmc-input font-mono-num" value={paidAmount}
                onChange={e => { setTouchedPaid(true); setPaidAmount(Number(e.target.value)); }}/>
            </div>
          </div>
          {creditBalance > 0 && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Store credit available: <span className="font-mono-num font-semibold">Rs. {creditBalance.toFixed(0)}</span>
              </div>
              <div>
                <label className="kmc-label">Redeem Credit (Rs.)</label>
                <input type="number" min="0" max={Math.min(creditBalance, total)} className="kmc-input font-mono-num"
                  value={redeemCredit} onChange={e => { setTouchedPaid(false); setRedeemCredit(Number(e.target.value)); }}/>
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between bg-mist rounded-xl px-4 py-3">
            <div className="text-sm text-gray-600">
              Total: <span className="font-mono-num font-bold text-navy-900 text-lg">Rs. {total.toFixed(0)}</span>
            </div>
            <span className={`kmc-badge ${payStatus==='paid' ? 'bg-emerald-100 text-emerald-800' : payStatus==='partial' ? 'bg-amber-100 text-amber-800' : 'bg-crimson-100 text-crimson-800'}`}>{payStatus}</span>
          </div>
          <div className="mt-3">
            <label className="kmc-label">Notes</label>
            <input className="kmc-input" placeholder="Optional remarks..." value={notes} onChange={e => setNotes(e.target.value)}/>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="kmc-btn-accent">
            {submitting ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </form>
    </div>
  );
}
