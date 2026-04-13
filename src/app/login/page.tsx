'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientSupabaseClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createClientSupabaseClient();
  const router   = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, is_active')
        .eq('username', username.trim())
        .single();

      if (!profile) { setError('Benutzername nicht gefunden.'); setLoading(false); return; }
      if (!profile.is_active) { setError('Dein Account ist deaktiviert.'); setLoading(false); return; }

      const { data: authData } = await supabase.from('profiles').select('email').eq('id', profile.id).single();
      const email = (authData as any)?.email || `${profile.username}@candylife.internal`;

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setError('Falsches Passwort.'); setLoading(false); return; }

      router.push('/dashboard');
    } catch {
      setError('Ein Fehler ist aufgetreten.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0b10] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-2/5 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-500/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-purple-500/30">
            <span className="text-white font-black text-2xl">C</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">CandyLife</h1>
          <p className="text-gray-500 text-sm mt-1">Staff Team Portal · FiveM Roleplay</p>
        </div>

        {/* Card */}
        <div className="bg-[#13151f] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white font-bold text-xl mb-6">Anmelden</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">Benutzername</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="dein benutzername"
                required
                className="w-full bg-[#0d0e14] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-gray-700 text-sm focus:outline-none focus:border-purple-500/70 transition"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs font-medium mb-1.5 block">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#0d0e14] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-gray-700 text-sm focus:outline-none focus:border-purple-500/70 transition"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 hover:from-pink-700 hover:via-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg shadow-purple-500/20 mt-2"
            >
              {loading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </form>

          <p className="text-gray-700 text-xs text-center mt-6">
            Kein Zugang? Kontaktiere einen Administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
