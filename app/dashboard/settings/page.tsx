'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, RefreshCw, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';
import { api } from '@/lib/api-client';

type WAStatus = {
  enabled: boolean;
  state: 'disabled' | 'not_initialized' | 'initializing' | 'qr' | 'connected' | 'auth_failed';
  qrDataUrl?: string | null;
  lastError?: string | null;
};

const STATE_LABELS: Record<string, string> = {
  disabled: 'Disabled (WHATSAPP_ENABLED is off)',
  not_initialized: 'Not started yet',
  initializing: 'Starting up...',
  qr: 'Scan the QR code below',
  connected: 'Connected',
  auth_failed: 'Authentication failed'
};

export default function SettingsPage() {
  const [wa, setWa] = useState<WAStatus | null>(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchStatus() {
    try {
      const data = await api.get('/api/whatsapp/status');
      setWa(data);
      return data as WAStatus;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }

  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus();
      if (data && (data.state === 'connected' || data.state === 'auth_failed')) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
  }

  async function handleConnect() {
    setConnecting(true);
    setError('');
    try {
      await api.post('/api/whatsapp/init');
      startPolling();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">WhatsApp connection and clinic information.</p>
      </div>

      {error && <div className="kmc-card p-4 border-crimson-200 bg-crimson-50 text-crimson-700 text-sm">{error}</div>}

      <div className="kmc-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <MessageCircle size={18} />
          </div>
          <div>
            <h2 className="font-display font-semibold text-navy-900">WhatsApp Connection</h2>
            <p className="text-xs text-gray-500">{wa ? STATE_LABELS[wa.state] : 'Checking status...'}</p>
          </div>
        </div>

        {!wa?.enabled && (
          <div className="bg-amber-50 text-amber-800 text-sm p-4 rounded-xl flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>
              WhatsApp automation is turned off (WHATSAPP_ENABLED is not set to true in .env). Manual sending via a
              pre-filled WhatsApp link always works regardless of this setting — see each appointment's detail page.
            </p>
          </div>
        )}

        {wa?.enabled && wa.state === 'connected' && (
          <div className="bg-emerald-50 text-emerald-800 text-sm p-4 rounded-xl flex items-center gap-2">
            <CheckCircle2 size={16} /> WhatsApp is connected. Appointment confirmations will send automatically.
          </div>
        )}

        {wa?.enabled && wa.state === 'auth_failed' && (
          <div className="bg-crimson-50 text-crimson-800 text-sm p-4 rounded-xl flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>Authentication failed{wa.lastError ? `: ${wa.lastError}` : '.'} Try connecting again below.</p>
          </div>
        )}

        {wa?.enabled && (wa.state === 'not_initialized' || wa.state === 'auth_failed') && (
          <button onClick={handleConnect} disabled={connecting} className="kmc-btn-primary mt-4 flex items-center gap-2">
            <RefreshCw size={15} className={connecting ? 'animate-spin' : ''} /> {connecting ? 'Starting...' : 'Connect WhatsApp'}
          </button>
        )}

        {wa?.enabled && wa.state === 'initializing' && (
          <p className="text-sm text-gray-500 mt-4 flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> Starting WhatsApp session, this can take a moment...
          </p>
        )}

        {wa?.enabled && wa.state === 'qr' && wa.qrDataUrl && (
          <div className="mt-4 flex flex-col items-center gap-3 bg-mist rounded-xl p-6">
            <img src={wa.qrDataUrl} alt="WhatsApp QR code" className="w-48 h-48" />
            <p className="text-xs text-gray-500 text-center max-w-sm">
              Open WhatsApp on the clinic's phone → Settings → Linked Devices → Link a Device, then scan this code.
              The session is saved so this only needs to be done once.
            </p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-5 border-t border-gray-100 pt-4">
          This connects through an unofficial WhatsApp Web automation library, not Meta's paid Business API. It works
          well for normal clinic volume, but very high message volume could risk number restrictions. The manual
          "Open WhatsApp Chat" link on every appointment is always available as a reliable fallback.
        </p>
      </div>

      <div className="kmc-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
            <Building2 size={18} />
          </div>
          <h2 className="font-display font-semibold text-navy-900">Clinic Information</h2>
        </div>
        <p className="text-xs text-gray-500">
          Clinic name, address, phone and email shown on PDF slips and WhatsApp messages are configured via the
          <code className="font-mono-num bg-mist px-1.5 py-0.5 rounded ml-1">CLINIC_*</code> environment variables in
          your <code className="font-mono-num bg-mist px-1.5 py-0.5 rounded">.env</code> file. Update them there and
          restart the server to apply changes.
        </p>
      </div>
    </div>
  );
}
