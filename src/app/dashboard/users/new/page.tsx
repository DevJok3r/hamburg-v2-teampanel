'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types';
import { ROLE_LABELS } from '@/lib/permissions';

const ALL_ROLES: UserRole[] = [
  'top_management', 'management', 'junior_management',
  'moderation_team', 'development_team', 'social_media_team', 'event_team',
];

export default function NewUserPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ username: '', password: '', role: 'moderation_team' as UserRole });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Fehler beim Anlegen');
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push('/dashboard/users'), 1500);
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Neues Mitglied anlegen</h1>
        <p className="text-gray-400 text-sm mt-1">
          Erstelle einen neuen Account für das Hamburg V2 Team.
        </p>
      </div>

      <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Benutzername</label>
            <input
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
              required
              minLength={3}
              pattern="[a-z0-9_.]+"
              title="Nur Kleinbuchstaben, Zahlen, Unterstriche und Punkte"
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3
                         text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              placeholder="max.mustermann"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Passwort</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
              minLength={8}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3
                         text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
              placeholder="Mindestens 8 Zeichen"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Rolle</label>
            <select
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3
                         text-white focus:outline-none focus:border-blue-500 text-sm"
            >
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
              <p className="text-green-400 text-sm">Benutzer erfolgreich angelegt! Weiterleitung...</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => router.back()}
              className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 font-medium py-3
                         rounded-lg transition text-sm">
              Abbrechen
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white
                         font-medium py-3 rounded-lg transition text-sm">
              {loading ? 'Anlegen...' : 'Anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}