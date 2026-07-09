'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Stethoscope, Lock, User, Loader2 } from 'lucide-react';

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Login failed.');
        setLoading(false);
        return;
      }
      // Hard redirect so middleware sees the new session cookie immediately
      window.location.href = params.get('next') || '/dashboard';
    } catch {
      setError('Could not reach the server. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-navy-950 px-4 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-crimson-600/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-navy-500/30 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-navy-600 to-crimson-600 flex items-center justify-center shadow-pop mb-4">
            <Stethoscope className="text-white" size={26} />
          </div>
          <h1 className="font-display text-white text-2xl font-bold tracking-tight text-center">
            Kalsoom Medical Complex
          </h1>
          <p className="text-navy-200 text-sm mt-1">Appointment Desk &middot; Staff Login</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-pop p-7">
          <div className="mb-4">
            <label className="kmc-label">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" size={16} />
              <input
                className="kmc-input pl-9"
                placeholder="e.g. admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>
          <div className="mb-2">
            <label className="kmc-label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" size={16} />
              <input
                type="password"
                className="kmc-input pl-9"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-crimson-600 text-sm font-medium bg-crimson-50 border border-crimson-100 rounded-lg px-3 py-2 mt-3">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="kmc-btn-primary w-full mt-5 flex items-center justify-center gap-2">
            {loading && <Loader2 className="animate-spin" size={16} />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-navy-300 text-xs mt-6">
          Access is provided by the clinic administrator. Contact your super admin if you need an account.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
