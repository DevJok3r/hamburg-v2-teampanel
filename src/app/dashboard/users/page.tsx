'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types';
import { can, ROLE_LABELS } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';
import Link from 'next/link';

export default function UsersPage() {
  const [users, setUsers]           = useState<Profile[]>([]);
  const [myRole, setMyRole]         = useState<UserRole | null>(null);
  const [myId, setMyId]             = useState<string>('');
  const [loading, setLoading]       = useState(true);
  const [pwModal, setPwModal]       = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError]       = useState('');
  const [pwSuccess, setPwSuccess]   = useState(false);
  const [pwLoading, setPwLoading]   = useState(false);

  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();

    if (profile) setMyRole(profile.role as UserRole);

    const { data } = await supabase
      .from('profiles').select('*')
      .order('role').order('username');

    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function changePassword() {
    if (!pwModal || !newPassword || newPassword.length < 8) {
      setPwError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    setPwLoading(true);
    setPwError('');

    const res = await fetch('/api/users/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: pwModal.id, newPassword }),
    });

    const data = await res.json();
    setPwLoading(false);

    if (!res.ok) {
      setPwError(data.error || 'Fehler beim Ändern');
      return;
    }

    setPwSuccess(true);
    setTimeout(() => {
      setPwModal(null);
      setNewPassword('');
      setPwSuccess(false);
    }, 1500);
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  if (!myRole || !can.viewAllUsers(myRole)) {
    return <div className="text-red-400 text-center py-12">Keine Berechtigung</div>;
  }

  return (
    <div className="space-y-6">
      {/* Passwort Modal */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-2">Passwort ändern</h2>
            <p className="text-gray-400 text-sm mb-5">
              Passwort für <span className="text-blue-400 font-medium">{pwModal.username}</span> ändern
            </p>
            <div className="space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Neues Passwort (min. 8 Zeichen)"
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3
                           text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
              {pwError && (
                <p className="text-red-400 text-sm">{pwError}</p>
              )}
              {pwSuccess && (
                <p className="text-green-400 text-sm">Passwort erfolgreich geändert!</p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setPwModal(null); setNewPassword(''); setPwError(''); }}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm transition">
                  Abbrechen
                </button>
                <button onClick={changePassword} disabled={pwLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium
                             px-5 py-2 rounded-lg text-sm transition">
                  {pwLoading ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Benutzerverwaltung</h1>
          <p className="text-gray-400 text-sm mt-1">{users.length} Benutzer gesamt</p>
        </div>
        {can.createUser(myRole) && (
          <Link href="/dashboard/users/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
                       px-4 py-2 rounded-lg transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Mitglied
          </Link>
        )}
      </div>

      <div className="bg-[#1a1d27] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Benutzer</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Rolle</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Letzter Login</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Erstellt am</th>
                {can.changePassword(myRole) && (
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Aktionen</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user: Profile) => (
                <tr key={user.id} className="hover:bg-white/2 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full
                                      flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm font-medium">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-md border font-medium
                      ${user.is_active
                        ? 'bg-green-500/10 text-green-400 border-green-500/30'
                        : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                      {user.is_active ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {user.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleString('de-DE', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : 'Noch nie'}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {new Date(user.created_at).toLocaleDateString('de-DE')}
                  </td>
                  {can.changePassword(myRole) && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => { setPwModal(user); setNewPassword(''); setPwError(''); }}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border
                                   border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                      >
                        Passwort ändern
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}