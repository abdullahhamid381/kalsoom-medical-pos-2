'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api-client';

type Organism = { id: number; name: string };
type Antibiotic = { id: number; name: string };
type Sensitivity = { antibiotic_id: number; antibiotic_name: string; result: 'S' | 'I' | 'R' };
type CultureOrganism = { organism_id: number; organism_name: string; growth_count: string; sensitivities: Sensitivity[] };

const SIR_COLORS: Record<string, string> = { S: 'bg-emerald-100 text-emerald-800', I: 'bg-amber-100 text-amber-800', R: 'bg-crimson-100 text-crimson-800' };

function OrganismPicker({ onAdd }: { onAdd: (o: Organism) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Organism[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => { api.get(`/api/lab/organisms?q=${encodeURIComponent(query.trim())}`).then(d => setResults(d.organisms || [])).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function addNew() {
    const name = query.trim();
    if (!name) return;
    const d = await api.post('/api/lab/organisms', { name });
    onAdd(d.organism); setQuery(''); setOpen(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <input className="kmc-input text-sm" placeholder="Search or add organism (e.g. E. coli)..." value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && query.trim() && (
        <div className="absolute z-30 mt-1 w-full kmc-card shadow-pop max-h-48 overflow-y-auto">
          {results.map(o => (
            <button key={o.id} type="button" onMouseDown={() => { onAdd(o); setQuery(''); setOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-mist border-b border-gray-50 last:border-0 text-sm">{o.name}</button>
          ))}
          <button type="button" onMouseDown={addNew} className="w-full text-left px-4 py-2 hover:bg-mist text-sm font-semibold text-crimson-600">+ Add "{query.trim()}"</button>
        </div>
      )}
    </div>
  );
}

function AntibioticPicker({ onAdd }: { onAdd: (a: Antibiotic) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Antibiotic[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => { api.get(`/api/lab/antibiotics?q=${encodeURIComponent(query.trim())}`).then(d => setResults(d.antibiotics || [])).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function addNew() {
    const name = query.trim();
    if (!name) return;
    const d = await api.post('/api/lab/antibiotics', { name });
    onAdd(d.antibiotic); setQuery(''); setOpen(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <input className="kmc-input text-xs py-1.5" placeholder="Add antibiotic to test..." value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && query.trim() && (
        <div className="absolute z-30 mt-1 w-full kmc-card shadow-pop max-h-48 overflow-y-auto">
          {results.map(a => (
            <button key={a.id} type="button" onMouseDown={() => { onAdd(a); setQuery(''); setOpen(false); }} className="w-full text-left px-4 py-2 hover:bg-mist border-b border-gray-50 last:border-0 text-sm">{a.name}</button>
          ))}
          <button type="button" onMouseDown={addNew} className="w-full text-left px-4 py-2 hover:bg-mist text-sm font-semibold text-crimson-600">+ Add "{query.trim()}"</button>
        </div>
      )}
    </div>
  );
}

export default function CultureSensitivityEntry({
  orderId, orderItemId, readOnly, initial, onSave
}: {
  orderId: string | number;
  orderItemId: number;
  readOnly: boolean;
  initial: CultureOrganism[];
  onSave: (organisms: CultureOrganism[]) => void;
}) {
  const [organisms, setOrganisms] = useState<CultureOrganism[]>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setOrganisms(initial); }, [initial]);

  function addOrganism(o: Organism) {
    if (organisms.find(x => x.organism_id === o.id)) return;
    setOrganisms(prev => [...prev, { organism_id: o.id, organism_name: o.name, growth_count: '', sensitivities: [] }]);
  }
  function removeOrganism(organismId: number) {
    setOrganisms(prev => prev.filter(o => o.organism_id !== organismId));
  }
  function updateGrowth(organismId: number, growth_count: string) {
    setOrganisms(prev => prev.map(o => o.organism_id === organismId ? { ...o, growth_count } : o));
  }
  function addAntibiotic(organismId: number, a: Antibiotic) {
    setOrganisms(prev => prev.map(o => o.organism_id === organismId
      ? { ...o, sensitivities: o.sensitivities.find(s => s.antibiotic_id === a.id) ? o.sensitivities : [...o.sensitivities, { antibiotic_id: a.id, antibiotic_name: a.name, result: 'S' }] }
      : o));
  }
  function setSensitivity(organismId: number, antibioticId: number, result: 'S' | 'I' | 'R') {
    setOrganisms(prev => prev.map(o => o.organism_id === organismId
      ? { ...o, sensitivities: o.sensitivities.map(s => s.antibiotic_id === antibioticId ? { ...s, result } : s) }
      : o));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.post(`/api/lab/orders/${orderId}/results/culture`, {
        order_item_id: orderItemId,
        organisms: organisms.map(o => ({ organism_id: o.organism_id, growth_count: o.growth_count, sensitivities: o.sensitivities.map(s => ({ antibiotic_id: s.antibiotic_id, result: s.result })) }))
      });
      onSave(organisms);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {organisms.length === 0 && <p className="text-xs text-gray-400">No organisms added yet — "No growth" will be reported if saved empty.</p>}
      {organisms.map(o => (
        <div key={o.organism_id} className="border border-gray-100 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-navy-900 text-sm">{o.organism_name}</p>
            {!readOnly && <button type="button" onClick={() => removeOrganism(o.organism_id)} className="text-gray-300 hover:text-crimson-600"><X size={14}/></button>}
          </div>
          <input disabled={readOnly} className="kmc-input text-xs py-1.5" placeholder="Growth / colony count (e.g. >10^5 CFU/mL)" value={o.growth_count} onChange={e => updateGrowth(o.organism_id, e.target.value)} />
          {o.sensitivities.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {o.sensitivities.map(s => (
                <div key={s.antibiotic_id} className="flex items-center justify-between bg-mist rounded-lg px-2.5 py-1.5">
                  <span className="text-xs text-gray-700">{s.antibiotic_name}</span>
                  <div className="flex gap-1">
                    {(['S', 'I', 'R'] as const).map(r => (
                      <button key={r} type="button" disabled={readOnly} onClick={() => setSensitivity(o.organism_id, s.antibiotic_id, r)}
                        className={`w-5 h-5 rounded text-[10px] font-bold ${s.result === r ? SIR_COLORS[r] : 'bg-white text-gray-400 border border-gray-200'}`}>{r}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!readOnly && <AntibioticPicker onAdd={(a) => addAntibiotic(o.organism_id, a)} />}
        </div>
      ))}
      {!readOnly && (
        <div className="flex items-center gap-2">
          <div className="flex-1"><OrganismPicker onAdd={addOrganism} /></div>
          <button type="button" onClick={handleSave} disabled={saving} className="kmc-btn-primary text-xs px-3 py-2 flex items-center gap-1.5"><Plus size={13}/> {saving ? 'Saving...' : 'Save Culture'}</button>
        </div>
      )}
    </div>
  );
}
