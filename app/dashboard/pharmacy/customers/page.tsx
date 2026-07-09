'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api-client';

export default function CustomersPage() {
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [phone, setPhone] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.get('/api/pharmacy/customers/outstanding').then(d => setOutstanding(d.customers || [])).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setSearching(true); setError('');
    try {
      const d = await api.get(`/api/pharmacy/customer-credit?phone=${encodeURIComponent(phone.trim())}`);
      setEntries(d.entries || []);
      setBalance(d.balance ?? 0);
    } catch (e: any) { setError(e.message); }
    finally { setSearching(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Customer Credit</h1>
        <p className="text-sm text-gray-500 mt-1">Outstanding balances and store credit owed to customers.</p>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <div className="kmc-card">
        <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-display font-semibold text-navy-900">Outstanding Balances</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                {['Customer','Phone','Sales','Billed','Paid','Outstanding'].map(h => <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>}
              {!loading && outstanding.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No outstanding balances.</td></tr>}
              {outstanding.map((c: any) => (
                <tr key={c.phone} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-navy-900">{c.patient_name}</td>
                  <td className="px-4 py-3 font-mono-num text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 font-mono-num text-gray-600">{c.sale_count}</td>
                  <td className="px-4 py-3 font-mono-num text-gray-600">Rs. {c.total_billed}</td>
                  <td className="px-4 py-3 font-mono-num text-gray-600">Rs. {c.total_paid}</td>
                  <td className="px-4 py-3 font-mono-num font-semibold text-crimson-700">Rs. {c.outstanding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="kmc-card p-5 space-y-4">
        <h2 className="font-display font-semibold text-navy-900">Store Credit Lookup</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input className="kmc-input pl-9 font-mono-num" placeholder="Customer phone number" value={phone} onChange={e => setPhone(e.target.value)}/>
          </div>
          <button type="submit" disabled={searching} className="kmc-btn-primary">{searching ? 'Searching...' : 'Search'}</button>
        </form>

        {balance !== null && (
          <div className="space-y-3">
            <div className={`kmc-badge text-sm font-bold px-3 py-1.5 ${balance > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
              Balance: Rs. {balance.toFixed(0)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                    <th className="pb-2">Date</th><th className="pb-2">Source</th><th className="pb-2">Notes</th><th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-400">No credit history for this number.</td></tr>}
                  {entries.map((e: any) => (
                    <tr key={e.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-500 text-xs">{new Date(e.created_at).toLocaleString('en-PK')}</td>
                      <td className="py-2 capitalize">{e.source}</td>
                      <td className="py-2 text-gray-500 text-xs">{e.notes || '—'}</td>
                      <td className={`py-2 font-mono-num font-semibold text-right ${e.amount >= 0 ? 'text-emerald-700' : 'text-crimson-700'}`}>
                        {e.amount >= 0 ? '+' : ''}Rs. {e.amount.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
