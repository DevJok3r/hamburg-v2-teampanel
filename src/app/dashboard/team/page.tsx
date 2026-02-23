'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Profile, UserRole, MemberEntry, Warning, EntryType } from '@/types';
import { can, ROLE_LABELS } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';

export default function TeamPage() {
  const [members, setMembers]                 = useState<Profile[]>([]);
  const [myRole, setMyRole]                   = useState<UserRole | null>(null);
  const [myId, setMyId]                       = useState<string>('');
  const [loading, setLoading]                 = useState(true);
  const [selectedMember, setSelectedMember]   = useState<Profile | null>(null);
  const [entries, setEntries]                 = useState<MemberEntry[]>([]);
  const [warnings, setWarnings]               = useState<Warning[]>([]);
  const [showEntryForm, setShowEntryForm]     = useState(false);
  const [showWarnForm, setShowWarnForm]       = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [showRoleForm, setShowRoleForm]       = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [entryForm, setEntryForm]             = useState({ type: 'misconduct' as EntryType, text: '' });
  const [warnForm, setWarnForm]               = useState({ reason: '' });
  const [selectedRole, setSelectedRole]       = useState<UserRole>('moderation_team');
  const [absenceForm, setAbsenceForm]         = useState({ from_date: '', to_date: '', reason: '' });

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
      .eq('is_active', true)
      .order('role').order('username');

    setMembers(data || []);
    setLoading(false);
  }

  async function loadMemberDetails(memberId: string) {
    const { data: memberEntries } = await supabase
      .from('member_entries')
      .select('*, creator:created_by(username)')
      .eq('user_id', memberId)
      .order('created_at', { ascending: false });

    const { data: memberWarnings } = await supabase
      .from('warnings')
      .select('*, creator:created_by(username)')
      .eq('user_id', memberId)
      .order('created_at', { ascending: false });

    setEntries(memberEntries || []);
    setWarnings(memberWarnings || []);
  }

  useEffect(() => { load(); }, []);

  async function openMember(member: Profile) {
    setSelectedMember(member);
    setShowEntryForm(false);
    setShowWarnForm(false);
    setShowKickConfirm(false);
    setShowRoleForm(false);
    setShowAbsenceForm(false);
    setSelectedRole(member.role);
    if (myRole && can.manageEntries(myRole)) {
      await loadMemberDetails(member.id);
    }
  }

  async function addEntry() {
    if (!entryForm.text.trim() || !selectedMember) return;
    await supabase.from('member_entries').insert({
      user_id: selectedMember.id,
      type: entryForm.type,
      text: entryForm.text,
      created_by: myId,
    });
    setEntryForm({ type: 'misconduct', text: '' });
    setShowEntryForm(false);
    await loadMemberDetails(selectedMember.id);
  }

  async function deleteEntry(id: string) {
    await supabase.from('member_entries').delete().eq('id', id);
    if (selectedMember) await loadMemberDetails(selectedMember.id);
  }

  async function addWarning() {
    if (!warnForm.reason.trim() || !selectedMember) return;
    await supabase.from('warnings').insert({
      user_id: selectedMember.id,
      reason: warnForm.reason,
      created_by: myId,
    });
    setWarnForm({ reason: '' });
    setShowWarnForm(false);
    await loadMemberDetails(selectedMember.id);
  }

  async function deleteWarning(id: string) {
    await supabase.from('warnings').delete().eq('id', id);
    if (selectedMember) await loadMemberDetails(selectedMember.id);
  }

  async function kickMember() {
    if (!selectedMember) return;
    await supabase.from('profiles')
      .update({ is_active: false })
      .eq('id', selectedMember.id);
    setSelectedMember(null);
    setShowKickConfirm(false);
    load();
  }

  async function changeRole() {
    if (!selectedMember) return;
    await supabase.from('profiles')
      .update({ role: selectedRole })
      .eq('id', selectedMember.id);
    setShowRoleForm(false);
    setSelectedMember({ ...selectedMember, role: selectedRole });
    load();
  }

  async function addAbsence() {
    if (!absenceForm.from_date || !absenceForm.to_date || !absenceForm.reason.trim() || !selectedMember) return;
    await supabase.from('absences').insert({
      user_id: selectedMember.id,
      from_date: absenceForm.from_date,
      to_date: absenceForm.to_date,
      reason: absenceForm.reason,
    });
    setAbsenceForm({ from_date: '', to_date: '', reason: '' });
    setShowAbsenceForm(false);
  }

  const canManage = myRole ? can.manageEntries(myRole) : false;
  const canKick   = myRole ? can.kickMember(myRole) : false;
  const canChangeRole = myRole ? can.editUser(myRole) : false;

  const allRoles: UserRole[] = [
    'top_management', 'management', 'junior_management',
    'moderation_team', 'development_team', 'social_media_team', 'event_team'
  ];

  // Top Management Mitglieder sind geschützt – nur Top Management darf sie bearbeiten
  function canActOn(targetRole: UserRole): boolean {
    if (!myRole) return false;
    if (myRole === 'top_management') return true;
    if (targetRole === 'top_management') return false;
    return can.manageEntries(myRole);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Team Übersicht</h1>
        <p className="text-gray-400 text-sm mt-1">{members.length} aktive Mitglieder</p>
      </div>

      {/* Mitglied Detail Modal */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">

            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full
                                flex items-center justify-center text-white font-bold text-lg">
                  {selectedMember.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-bold text-lg">{selectedMember.username}</p>
                  <RoleBadge role={selectedMember.role} size="sm" />
                </div>
              </div>
              <button onClick={() => setSelectedMember(null)}
                className="text-gray-400 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Dabei seit</p>
                  <p className="text-white text-sm">{new Date(selectedMember.created_at).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Letzter Login</p>
                  <p className="text-white text-sm">
                    {selectedMember.last_sign_in_at
                      ? new Date(selectedMember.last_sign_in_at).toLocaleDateString('de-DE')
                      : 'Noch nie'}
                  </p>
                </div>
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Verwarnungen</p>
                  <p className={`text-sm font-bold ${warnings.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {warnings.length}
                  </p>
                </div>
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Einträge</p>
                  <p className="text-white text-sm font-bold">{entries.length}</p>
                </div>
              </div>

              {/* Aktionen */}
              {canManage && selectedMember.id !== myId && canActOn(selectedMember.role) && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setShowEntryForm(!showEntryForm); setShowWarnForm(false); setShowKickConfirm(false); setShowRoleForm(false); setShowAbsenceForm(false); }}
                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30
                               text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    Eintrag hinzufügen
                  </button>
                  <button
                    onClick={() => { setShowWarnForm(!showWarnForm); setShowEntryForm(false); setShowKickConfirm(false); setShowRoleForm(false); setShowAbsenceForm(false); }}
                    className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30
                               text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    Verwarnen
                  </button>
                  {canChangeRole && (
                    <button
                      onClick={() => { setShowRoleForm(!showRoleForm); setShowEntryForm(false); setShowWarnForm(false); setShowKickConfirm(false); setShowAbsenceForm(false); }}
                      className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30
                                 text-sm font-medium px-4 py-2 rounded-lg transition"
                    >
                      Rolle ändern
                    </button>
                  )}
                  <button
                    onClick={() => { setShowAbsenceForm(!showAbsenceForm); setShowEntryForm(false); setShowWarnForm(false); setShowKickConfirm(false); setShowRoleForm(false); }}
                    className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30
                               text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    Abmelden
                  </button>
                  {canKick && (
                    <button
                      onClick={() => { setShowKickConfirm(!showKickConfirm); setShowEntryForm(false); setShowWarnForm(false); setShowRoleForm(false); setShowAbsenceForm(false); }}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30
                                 text-sm font-medium px-4 py-2 rounded-lg transition"
                    >
                      Rauswerfen
                    </button>
                  )}
                </div>
              )}

              {/* Rolle ändern */}
              {showRoleForm && (
                <div className="bg-[#0f1117] rounded-xl p-4 space-y-3">
                  <h4 className="text-white font-medium text-sm">Rolle ändern</h4>
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value as UserRole)}
                    className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    {allRoles.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowRoleForm(false)}
                      className="bg-white/5 hover:bg-white/10 text-gray-300 text-sm px-4 py-2 rounded-lg transition">
                      Abbrechen
                    </button>
                    <button onClick={changeRole}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                      Speichern
                    </button>
                  </div>
                </div>
              )}

              {/* Abmelden Formular */}
              {showAbsenceForm && (
                <div className="bg-[#0f1117] rounded-xl p-4 space-y-3">
                  <h4 className="text-white font-medium text-sm">Mitglied abmelden</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Von</label>
                      <input type="datetime-local" value={absenceForm.from_date}
                        onChange={e => setAbsenceForm(p => ({ ...p, from_date: e.target.value }))}
                        className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2
                                   text-white text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Bis</label>
                      <input type="datetime-local" value={absenceForm.to_date}
                        onChange={e => setAbsenceForm(p => ({ ...p, to_date: e.target.value }))}
                        className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2
                                   text-white text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <textarea
                    value={absenceForm.reason}
                    onChange={e => setAbsenceForm(p => ({ ...p, reason: e.target.value }))}
                    placeholder="Grund der Abmeldung..."
                    rows={2}
                    className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-4 py-2.5
                               text-white placeholder-gray-500 text-sm focus:outline-none
                               focus:border-blue-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAbsenceForm(false)}
                      className="bg-white/5 hover:bg-white/10 text-gray-300 text-sm px-4 py-2 rounded-lg transition">
                      Abbrechen
                    </button>
                    <button onClick={addAbsence}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                      Abmelden
                    </button>
                  </div>
                </div>
              )}

              {/* Eintrag Formular */}
              {showEntryForm && (
                <div className="bg-[#0f1117] rounded-xl p-4 space-y-3">
                  <h4 className="text-white font-medium text-sm">Neuer Eintrag</h4>
                  <div className="flex gap-2">
                    {(['misconduct', 'positive', 'other'] as EntryType[]).map(t => (
                      <button key={t}
                        onClick={() => setEntryForm(p => ({ ...p, type: t }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition
                          ${entryForm.type === t
                            ? t === 'misconduct' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : t === 'positive' ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            : 'bg-white/5 text-gray-400 border-white/10'}`}
                      >
                        {t === 'misconduct' ? 'Fehlverhalten' : t === 'positive' ? 'Kein Fehlverhalten' : 'Sonstiges'}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={entryForm.text}
                    onChange={e => setEntryForm(p => ({ ...p, text: e.target.value }))}
                    placeholder="Beschreibung des Eintrags..."
                    rows={3}
                    className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-4 py-2.5
                               text-white placeholder-gray-500 text-sm focus:outline-none
                               focus:border-blue-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowEntryForm(false)}
                      className="bg-white/5 hover:bg-white/10 text-gray-300 text-sm px-4 py-2 rounded-lg transition">
                      Abbrechen
                    </button>
                    <button onClick={addEntry}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                      Speichern
                    </button>
                  </div>
                </div>
              )}

              {/* Verwarnungs Formular */}
              {showWarnForm && (
                <div className="bg-[#0f1117] rounded-xl p-4 space-y-3">
                  <h4 className="text-white font-medium text-sm">Verwarnung ausstellen</h4>
                  <textarea
                    value={warnForm.reason}
                    onChange={e => setWarnForm({ reason: e.target.value })}
                    placeholder="Grund der Verwarnung..."
                    rows={3}
                    className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-4 py-2.5
                               text-white placeholder-gray-500 text-sm focus:outline-none
                               focus:border-blue-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowWarnForm(false)}
                      className="bg-white/5 hover:bg-white/10 text-gray-300 text-sm px-4 py-2 rounded-lg transition">
                      Abbrechen
                    </button>
                    <button onClick={addWarning}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                      Verwarnen
                    </button>
                  </div>
                </div>
              )}

              {/* Kick Bestätigung */}
              {showKickConfirm && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-400 text-sm font-medium mb-3">
                    Bist du sicher dass du <span className="font-bold">{selectedMember.username}</span> rauswerfen willst?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowKickConfirm(false)}
                      className="bg-white/5 hover:bg-white/10 text-gray-300 text-sm px-4 py-2 rounded-lg transition">
                      Abbrechen
                    </button>
                    <button onClick={kickMember}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                      Ja, rauswerfen
                    </button>
                  </div>
                </div>
              )}

              {/* Verwarnungen */}
              {warnings.length > 0 && (
                <div>
                  <h4 className="text-white font-medium text-sm mb-2">Verwarnungen ({warnings.length})</h4>
                  <div className="space-y-2">
                    {warnings.map(w => (
                      <div key={w.id} className="bg-[#0f1117] rounded-lg p-3 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-yellow-400 text-sm">{w.reason}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            von {(w.creator as any)?.username} · {new Date(w.created_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        {myRole && can.deleteEntries(myRole) && (
                          <button onClick={() => deleteWarning(w.id)}
                            className="text-gray-500 hover:text-red-400 transition flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Einträge */}
              {entries.length > 0 && (
                <div>
                  <h4 className="text-white font-medium text-sm mb-2">Einträge ({entries.length})</h4>
                  <div className="space-y-2">
                    {entries.map(e => (
                      <div key={e.id} className="bg-[#0f1117] rounded-lg p-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded border
                              ${e.type === 'misconduct' ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : e.type === 'positive' ? 'bg-green-500/10 text-green-400 border-green-500/30'
                                : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
                              {e.type === 'misconduct' ? 'Fehlverhalten' : e.type === 'positive' ? 'Kein Fehlverhalten' : 'Sonstiges'}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm">{e.text}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            von {(e.creator as any)?.username} · {new Date(e.created_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        {myRole && can.deleteEntries(myRole) && (
                          <button onClick={() => deleteEntry(e.id)}
                            className="text-gray-500 hover:text-red-400 transition flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canManage && entries.length === 0 && warnings.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">
                  Keine Einträge oder Verwarnungen vorhanden
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mitglieder Grid */}
      {loading ? (
        <div className="text-gray-400 text-center py-12">Lade...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(member => (
            <div
              key={member.id}
              onClick={() => openMember(member)}
              className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 cursor-pointer
                         hover:border-blue-500/30 hover:bg-[#1e2130] transition"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full
                                flex items-center justify-center text-white font-bold flex-shrink-0">
                  {member.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{member.username}</p>
                  <RoleBadge role={member.role} size="xs" />
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Dabei seit: {new Date(member.created_at).toLocaleDateString('de-DE')}
              </div>
              {canManage && (
                <p className="text-blue-400 text-xs mt-2">Klicken für Details →</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}