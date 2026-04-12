'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can, ROLE_LABELS, ROLE_HIERARCHY, DEPT_LABELS } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';
import Link from 'next/link';

type ModalType = 'password' | 'username' | 'role' | 'deactivate' | 'activate' | 'departments' | null;

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

export default function UsersPage() {
  const supabase = createClientSupabaseClient();
  const [users, setUsers]               = useState<any[]>([]);
  const [myRole, setMyRole]             = useState<UserRole | null>(null);
  const [myId, setMyId]                 = useState('');
  const [myUsername, setMyUsername]     = useState('');
  const [loading, setLoading]           = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [modalType, setModalType]       = useState<ModalType>(null);
  const [inputValue, setInputValue]     = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('test_supporter');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch]             = useState('');
  const [filterActive, setFilterActive] = useState<'all'|'active'|'inactive'>('active');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: p } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
    if (p) { setMyRole(p.role as UserRole); setMyUsername(p.username); }
    const { data } = await supabase.from('profiles').select('*').order('role').order('username');
    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openModal(user: any, type: ModalType) {
    setSelectedUser(user); setModalType(type);
    setInputValue(''); setSelectedRole(user.role);
    setSelectedDepts(user.departments || []);
    setError(''); setSuccess('');
  }

  function closeModal() { setSelectedUser(null); setModalType(null); setError(''); setSuccess(''); }

  async function handleAction() {
    if (!selectedUser || !myRole) return;
    setActionLoading(true); setError('');
    try {
      if (modalType === 'password') {
        if (inputValue.length < 8) { setError('Mindestens 8 Zeichen.'); setActionLoading(false); return; }
        const res = await fetch('/api/users/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selectedUser.id, newPassword: inputValue }) });
        if (!res.ok) { setError('Fehler.'); setActionLoading(false); return; }
        setSuccess('Passwort geändert!');
      } else if (modalType === 'username') {
        if (inputValue.trim().length < 3) { setError('Mindestens 3 Zeichen.'); setActionLoading(false); return; }
        const { error: e } = await supabase.from('profiles').update({ username: inputValue.trim() }).eq('id', selectedUser.id);
        if (e) { setError(e.message); setActionLoading(false); return; }
        setSuccess('Username geändert!');
      } else if (modalType === 'role') {
        const { error: e } = await supabase.from('profiles').update({ role: selectedRole }).eq('id', selectedUser.id);
        if (e) { setError(e.message); setActionLoading(false); return; }
        setSuccess('Rang geändert!');
      } else if (modalType === 'departments') {
        const { error: e } = await supabase.from('profiles').update({ departments: selectedDepts }).eq('id', selectedUser.id);
        if (e) { setError(e.message); setActionLoading(false); return; }
        setSuccess('Abteilungen gespeichert!');
      } else if (modalType === 'deactivate') {
        await supabase.from('profiles').update({ is_active: false }).eq('id', selectedUser.id);
        setSuccess('Deaktiviert!');
      } else if (modalType === 'activate') {
        await supabase.from('profiles').update({ is_active: true }).eq('id', selectedUser.id);
        setSuccess('Aktiviert!');
      }
      setTimeout(() => { closeModal(); load(); }, 1200);
    } catch { setError('Unbekannter Fehler.'); }
    setActionLoading(false);
  }

  const filtered = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase());
    const matchActive = filterActive === 'all' ? true : filterActive === 'active' ? u.is_active : !u.is_active;
    return matchSearch && matchActive;
  });

  const isTop = myRole ? can.isTopManagement(myRole) : false;
  const isOwner = myUsername === 'jxkerlds';

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Modal */}
      {selectedUser && modalType && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#13151f] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-white font-bold text-lg">
              {modalType === 'password' && 'Passwort ändern'}
              {modalType === 'username' && 'Username ändern'}
              {modalType === 'role' && 'Rang ändern'}
              {modalType === 'departments' && 'Abteilungen'}
              {modalType === 'deactivate' && 'Deaktivieren'}
              {modalType === 'activate' && 'Aktivieren'}
            </h2>
            <p className="text-gray-400 text-sm">Für: <span className="text-purple-400 font-medium">{selectedUser.username}</span></p>

            {modalType === 'password' && <input type="password" value={inputValue} onChange={e=>setInputValue(e.target.value)} placeholder="Neues Passwort..." className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/70" />}
            {modalType === 'username' && <input type="text" value={inputValue} onChange={e=>setInputValue(e.target.value)} placeholder={selectedUser.username} className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/70" />}
            {modalType === 'role' && (
              <select value={selectedRole} onChange={e=>setSelectedRole(e.target.value as UserRole)} className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/70">
                {ALL_ROLES.filter(r => isOwner || r !== 'projektleitung').map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            )}
            {modalType === 'departments' && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {DEPARTMENTS.map(d => (
                  <label key={d.key} className="flex items-center gap-3 bg-[#0d0e14] rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5">
                    <input type="checkbox" checked={selectedDepts.includes(d.key)} onChange={() => setSelectedDepts(p => p.includes(d.key) ? p.filter(x=>x!==d.key) : [...p, d.key])} className="accent-purple-500" />
                    <span className="text-white text-sm">{d.label}</span>
                  </label>
                ))}
              </div>
            )}
            {(modalType === 'deactivate' || modalType === 'activate') && (
              <p className="text-gray-400 text-sm bg-[#0d0e14] rounded-xl p-4">
                {modalType === 'deactivate' ? `${selectedUser.username} wirklich deaktivieren?` : `${selectedUser.username} wieder aktivieren?`}
              </p>
            )}
            {error   && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-green-400 text-sm">{success}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={closeModal} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-xl text-sm transition">Abbrechen</button>
              <button onClick={handleAction} disabled={actionLoading}
                className={`disabled:opacity-50 text-white font-medium px-5 py-2 rounded-xl text-sm transition ${modalType === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700'}`}>
                {actionLoading ? 'Speichern...' : 'Bestätigen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mitglieder</h1>
          <p className="text-gray-500 text-sm mt-1">{users.filter(u=>u.is_active).length} aktive Mitglieder · {users.length} gesamt</p>
        </div>
        {isTop && (
          <Link href="/dashboard/users/new" className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Neues Mitglied
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#13151f] border border-green-500/20 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{users.filter(u=>u.is_active).length}</p>
          <p className="text-gray-500 text-xs mt-1">Aktiv</p>
        </div>
        <div className="bg-[#13151f] border border-red-500/20 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{users.filter(u=>!u.is_active).length}</p>
          <p className="text-gray-500 text-xs mt-1">Deaktiviert</p>
        </div>
        <div className="bg-[#13151f] border border-purple-500/20 rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{users.length}</p>
          <p className="text-gray-500 text-xs mt-1">Gesamt</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Mitglied suchen..."
          className="bg-[#13151f] border border-white/[0.08] rounded-xl px-4 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/50 w-64" />
        {(['all','active','inactive'] as const).map(f => (
          <button key={f} onClick={()=>setFilterActive(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition ${filterActive===f ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/30 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}>
            {f==='all'?'Alle':f==='active'?'Aktiv':'Inaktiv'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#13151f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Mitglied','Rang','Abteilungen','Status','Aktionen'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm font-medium">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4"><RoleBadge role={user.role} size="xs" /></td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1 flex-wrap">
                      {(user.departments||[]).length === 0 ? <span className="text-gray-700 text-xs">—</span>
                        : (user.departments||[]).map((d: string) => (
                        <span key={d} className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {DEPT_LABELS[d]?.replace(/》|《/g,'') || d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${user.is_active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {user.is_active ? '● Aktiv' : '○ Inaktiv'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {isTop && user.id !== myId && (isOwner || user.role !== 'projektleitung') && (
                      <div className="flex gap-1.5 flex-wrap">
                        {[
                          { label: 'Rang', type: 'role' as ModalType, color: 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20' },
                          { label: 'Abteilungen', type: 'departments' as ModalType, color: 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20' },
                          { label: 'Username', type: 'username' as ModalType, color: 'bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border-pink-500/20' },
                          { label: 'Passwort', type: 'password' as ModalType, color: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20' },
                        ].map(btn => (
                          <button key={btn.type} onClick={() => openModal(user, btn.type)}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${btn.color}`}>
                            {btn.label}
                          </button>
                        ))}
                        {user.is_active ? (
                          <button onClick={() => openModal(user, 'deactivate')} className="text-xs px-2.5 py-1 rounded-lg border font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 transition">Deaktivieren</button>
                        ) : (
                          <button onClick={() => openModal(user, 'activate')} className="text-xs px-2.5 py-1 rounded-lg border font-medium bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20 transition">Aktivieren</button>
                        )}
                      </div>
                    )}
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
