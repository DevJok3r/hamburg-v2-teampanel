'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types';
import { can, ROLE_LABELS, ROLE_HIERARCHY } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';
import Link from 'next/link';

type ModalType = 'password' | 'username' | 'role' | 'deactivate' | 'activate' | 'departments' | null;

const DEPARTMENTS = [
  { key: 'moderation_team',   label: 'Moderation Team' },
  { key: 'social_media_team', label: 'Social Media Team' },
  { key: 'event_team',        label: 'Event Team' },
  { key: 'development_team',  label: 'Development Team' },
];

export default function UsersPage() {
  const [users, setUsers]               = useState<Profile[]>([]);
  const [myRole, setMyRole]             = useState<UserRole | null>(null);
  const [myId, setMyId]                 = useState<string>('');
  const [loading, setLoading]           = useState(true);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [modalType, setModalType]       = useState<ModalType>(null);
  const [inputValue, setInputValue]     = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('moderator');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');
  const [search, setSearch]             = useState('');

  const supabase = createClientSupabaseClient();
  const isTopManagement = myRole === 'top_management';

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile) setMyRole(profile.role as UserRole);
    const { data } = await supabase.from('profiles').select('*').order('role').order('username');
    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openModal(user: Profile, type: ModalType) {
    setSelectedUser(user);
    setModalType(type);
    setInputValue('');
    setSelectedRole(user.role);
    setSelectedDepts((user as any).departments || []);
    setError('');
    setSuccess('');
  }

  function closeModal() {
    setSelectedUser(null);
    setModalType(null);
    setInputValue('');
    setError('');
    setSuccess('');
  }

  async function handleAction() {
    if (!selectedUser || !myRole) return;
    setActionLoading(true);
    setError('');

    try {
      if (modalType === 'password') {
        if (inputValue.length < 8) { setError('Mindestens 8 Zeichen.'); setActionLoading(false); return; }
        const res = await fetch('/api/users/password', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUser.id, newPassword: inputValue }),
        });
        if (!res.ok) { setError('Fehler beim Ändern.'); setActionLoading(false); return; }
        setSuccess('Passwort erfolgreich geändert!');
      }
      else if (modalType === 'username') {
        if (inputValue.trim().length < 3) { setError('Mindestens 3 Zeichen.'); setActionLoading(false); return; }
        const { error: err } = await supabase.from('profiles').update({ username: inputValue.trim() }).eq('id', selectedUser.id);
        if (err) { setError('Fehler: ' + err.message); setActionLoading(false); return; }
        setSuccess('Benutzername erfolgreich geändert!');
      }
      else if (modalType === 'role') {
        if (!isTopManagement && ROLE_HIERARCHY[selectedRole] >= ROLE_HIERARCHY[myRole]) {
          setError('Du kannst keine gleichwertige oder höhere Rolle vergeben.');
          setActionLoading(false); return;
        }
        const { error: err } = await supabase.from('profiles').update({ role: selectedRole }).eq('id', selectedUser.id);
        if (err) { setError('Fehler: ' + err.message); setActionLoading(false); return; }
        setSuccess('Rolle erfolgreich geändert!');
      }
      else if (modalType === 'departments') {
        const { error: err } = await supabase.from('profiles').update({ departments: selectedDepts }).eq('id', selectedUser.id);
        if (err) { setError('Fehler: ' + err.message); setActionLoading(false); return; }
        setSuccess('Abteilungen erfolgreich gespeichert!');
      }
      else if (modalType === 'deactivate') {
        const { error: err } = await supabase.from('profiles').update({ is_active: false }).eq('id', selectedUser.id);
        if (err) { setError('Fehler: ' + err.message); setActionLoading(false); return; }
        setSuccess('Benutzer deaktiviert!');
      }
      else if (modalType === 'activate') {
        const { error: err } = await supabase.from('profiles').update({ is_active: true }).eq('id', selectedUser.id);
        if (err) { setError('Fehler: ' + err.message); setActionLoading(false); return; }
        setSuccess('Benutzer aktiviert!');
      }

      setTimeout(() => { closeModal(); load(); }, 1200);
    } catch { setError('Unbekannter Fehler.'); }
    setActionLoading(false);
  }

  const allRoles = Object.keys(ROLE_LABELS) as UserRole[];

  const filtered = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase());
    const matchActive = filterActive === 'all' ? true : filterActive === 'active' ? u.is_active : !u.is_active;
    return matchSearch && matchActive;
  });

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;
  if (!myRole || !can.viewAllUsers(myRole)) return <div className="text-red-400 text-center py-12">Keine Berechtigung</div>;

  return (
    <div className="space-y-6">

      {/* Modal */}
      {selectedUser && modalType && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <div>
              <h2 className="text-white font-bold text-lg">
                {modalType === 'password'    && 'Passwort ändern'}
                {modalType === 'username'    && 'Benutzername ändern'}
                {modalType === 'role'        && 'Rolle ändern'}
                {modalType === 'departments' && 'Abteilungen bearbeiten'}
                {modalType === 'deactivate'  && 'Benutzer deaktivieren'}
                {modalType === 'activate'    && 'Benutzer aktivieren'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Aktion für <span className="text-blue-400 font-medium">{selectedUser.username}</span>
              </p>
            </div>

            {modalType === 'password' && (
              <input type="password" value={inputValue} onChange={e => setInputValue(e.target.value)}
                placeholder="Neues Passwort (min. 8 Zeichen)..."
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
            )}

            {modalType === 'username' && (
              <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)}
                placeholder={selectedUser.username}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
            )}

            {modalType === 'role' && (
              <select value={selectedRole} onChange={e => setSelectedRole(e.target.value as UserRole)}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500">
                {allRoles.filter(r => isTopManagement || ROLE_HIERARCHY[r] < ROLE_HIERARCHY[myRole!]).map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            )}

            {modalType === 'departments' && (
              <div className="space-y-2">
                <p className="text-gray-400 text-xs">Mehrere Abteilungen möglich</p>
                {DEPARTMENTS.map(dept => (
                  <label key={dept.key} className="flex items-center gap-3 bg-[#0f1117] rounded-lg px-4 py-3 cursor-pointer hover:bg-white/5 transition">
                    <input type="checkbox"
                      checked={selectedDepts.includes(dept.key)}
                      onChange={() => setSelectedDepts(prev =>
                        prev.includes(dept.key) ? prev.filter(d => d !== dept.key) : [...prev, dept.key]
                      )}
                      className="rounded accent-blue-500" />
                    <span className="text-white text-sm">{dept.label}</span>
                  </label>
                ))}
              </div>
            )}

            {(modalType === 'deactivate' || modalType === 'activate') && (
              <p className="text-gray-400 text-sm bg-[#0f1117] rounded-lg p-4">
                {modalType === 'deactivate'
                  ? `Bist du sicher, dass du ${selectedUser.username} deaktivieren möchtest? Der Benutzer kann sich danach nicht mehr einloggen.`
                  : `Bist du sicher, dass du ${selectedUser.username} wieder aktivieren möchtest?`}
              </p>
            )}

            {error   && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-green-400 text-sm">{success}</p>}

            <div className="flex gap-2 justify-end">
              <button onClick={closeModal}
                className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm transition">
                Abbrechen
              </button>
              <button onClick={handleAction} disabled={actionLoading}
                className={`disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition
                  ${modalType === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {actionLoading ? 'Speichern...' : 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Benutzerverwaltung</h1>
          <p className="text-gray-400 text-sm mt-1">{users.length} Benutzer gesamt</p>
        </div>
        {isTopManagement && (
          <Link href="/dashboard/users/new"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Mitglied
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{users.filter(u => u.is_active).length}</p>
          <p className="text-gray-400 text-xs mt-1">Aktive Mitglieder</p>
        </div>
        <div className="bg-[#1a1d27] border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{users.filter(u => !u.is_active).length}</p>
          <p className="text-gray-400 text-xs mt-1">Deaktiviert</p>
        </div>
        <div className="bg-[#1a1d27] border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{users.length}</p>
          <p className="text-gray-400 text-xs mt-1">Gesamt</p>
        </div>
      </div>

      {/* Filter & Suche */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Benutzer suchen..."
          className="bg-[#1a1d27] border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 w-64" />
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button key={f} onClick={() => setFilterActive(f)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition ${filterActive === f ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            {f === 'all' ? 'Alle' : f === 'active' ? 'Aktiv' : 'Deaktiviert'}
          </button>
        ))}
      </div>

      {/* Tabelle */}
      <div className="bg-[#1a1d27] border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Benutzer</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Rolle</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Abteilungen</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Letzter Login</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((user: any) => (
                <tr key={user.id} className="hover:bg-white/2 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm font-medium">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4"><RoleBadge role={user.role} /></td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {(user.departments || []).length === 0 ? (
                        <span className="text-gray-600 text-xs">–</span>
                      ) : (user.departments || []).map((d: string) => (
                        <span key={d} className="text-xs px-2 py-0.5 rounded border bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                          {DEPARTMENTS.find(x => x.key === d)?.label || d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-md border font-medium ${user.is_active ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                      {user.is_active ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Noch nie'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 flex-wrap">
                      {can.changeUserRole(myRole, user.role) && user.id !== myId && (
                        <button onClick={() => openModal(user, 'role')}
                          className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                          Rolle
                        </button>
                      )}
                      {isTopManagement && user.id !== myId && (
                        <>
                          <button onClick={() => openModal(user, 'departments')}
                            className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                            Abteilungen
                          </button>
                          <button onClick={() => openModal(user, 'username')}
                            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                            Username
                          </button>
                          <button onClick={() => openModal(user, 'password')}
                            className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                            Passwort
                          </button>
                          {user.is_active ? (
                            <button onClick={() => openModal(user, 'deactivate')}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                              Deaktivieren
                            </button>
                          ) : (
                            <button onClick={() => openModal(user, 'activate')}
                              className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                              Aktivieren
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}