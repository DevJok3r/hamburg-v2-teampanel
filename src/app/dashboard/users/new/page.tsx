'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can, ROLE_LABELS } from '@/lib/permissions';

const ALL_ROLES: UserRole[] = [
  'projektleitung','stv_projektleitung','manager',
  'teamleitung','stv_teamleitung',
  'head_developer','senior_developer','developer','junior_developer',
  'fraktionsmanagement','fraktionsverwaltung','junior_fraktionsverwaltung',
  'head_administrator','superadministrator','senior_administrator','administrator',
  'head_moderator','senior_moderator','moderator',
  'head_supporter','senior_supporter','supporter','test_supporter',
];

const DEPARTMENTS = [
  { key: 'support',             label: '》Support《' },
  { key: 'moderation',          label: '》Moderation《' },
  { key: 'administration',      label: '》Administration《' },
  { key: 'fraktionsmanagement', label: '》Fraktionsmanagement《' },
  { key: 'development',         label: '》Development《' },
  { key: 'teamleitung',         label: '》Teamleitung《' },
  { key: 'leitungsebene',       label: '》Leitungsebene《' },
];

export default function NewUserPage() {
  const supabase = createClientSupabaseClient();
  const router   = useRouter();
  const [myRole, setMyRole]   = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm]       = useState({ username: '', password: '', role: 'test_supporter' as UserRole, departments: [] as string[] });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (p) setMyRole(p.role as UserRole);
      setLoading(false);
    }
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.username.trim() || form.password.length < 8) { setError('Username und Passwort (min. 8 Zeichen) erforderlich.'); return; }
    setSaving(true); setError('');
    try {
      const email = `${form.username.trim().toLowerCase()}@candylife.internal`;
      const { data: authData, error: signUpError } = await supabase.auth.admin
        ? await (supabase as any).auth.admin.createUser({ email, password: form.password, email_confirm: true })
        : { data: null, error: new Error('Admin API nicht verfügbar') };

      if (signUpError || !authData?.user) {
        // Fallback: Use API route
        const res = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username.trim(), password: form.password, role: form.role, departments: form.departments }),
        });
        if (!res.ok) { const d = await res.json(); setError(d.error || 'Fehler'); setSaving(false); return; }
      } else {
        await supabase.from('profiles').insert({ id: authData.user.id, username: form.username.trim(), role: form.role, departments: form.departments, is_active: true });
      }
      router.push('/dashboard/users');
    } catch (e: any) {
      setError(e.message || 'Fehler');
    }
    setSaving(false);
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;
  if (!myRole || !can.isTopManagement(myRole)) return <div className="text-center py-12 text-gray-400">Kein Zugriff.</div>;

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Neues Mitglied</h1>
        <p className="text-gray-500 text-sm mt-1">Account erstellen</p>
      </div>

      <div className="bg-[#13151f] border border-white/[0.06] rounded-2xl p-6">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block">Benutzername *</label>
            <input value={form.username} onChange={e => setForm(p => ({...p, username: e.target.value}))} placeholder="benutzername"
              className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/70" />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block">Passwort * (min. 8 Zeichen)</label>
            <input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} placeholder="••••••••"
              className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/70" />
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-1.5 block">Rang</label>
            <select value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value as UserRole}))}
              className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/70">
              {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-2 block">Abteilungen</label>
            <div className="space-y-1.5">
              {DEPARTMENTS.map(d => (
                <label key={d.key} className="flex items-center gap-3 bg-[#0d0e14] rounded-xl px-4 py-2.5 cursor-pointer hover:bg-white/5">
                  <input type="checkbox" checked={form.departments.includes(d.key)}
                    onChange={() => setForm(p => ({ ...p, departments: p.departments.includes(d.key) ? p.departments.filter(x=>x!==d.key) : [...p.departments, d.key] }))}
                    className="accent-purple-500" />
                  <span className="text-gray-300 text-sm">{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => router.back()} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl text-sm font-medium transition">Abbrechen</button>
            <button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition">
              {saving ? 'Erstellen...' : 'Account erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
