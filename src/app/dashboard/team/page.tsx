'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Profile, UserRole, MemberEntry, Warning, EntryType } from '@/types';
import { can, ROLE_LABELS } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';

export default function TeamPage() {
  const [members, setMembers]             = useState<Profile[]>([]);
  const [myRole, setMyRole]               = useState<UserRole | null>(null);
  const [myId, setMyId]                   = useState<string>('');
  const [loading, setLoading]             = useState(true);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [entries, setEntries]             = useState<MemberEntry[]>([]);
  const [warnings, setWarnings]           = useState<Warning[]>([]);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showWarnForm, setShowWarnForm]   = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [entryForm, setEntryForm]         = useState({ type: 'misconduct' as EntryType, text: '' });
  const [warnForm, setWarnForm]           = useState({ reason: '' });

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

const canManage = myRole ? (can as any).manageEntries(myRole) : false;
const canKick   = myRole ? (can as any).kickMember(myRole) : false;

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

            {/* Header */}
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
              {canManage && selectedMember.id !== myId && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setShowEntryForm(!showEntryForm); setShowWarnForm(false); setShowKickConfirm(false); }}
                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30
                               text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    Eintrag hinzufügen
                  </button>
                  <button
                    onClick={() => { setShowWarnForm(!showWarnForm); setShowEntryForm(false); setShowKickConfirm(false); }}
                    className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30
                               text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    Verwarnen
                  </button>
                  {canKick && (
                    <button
                      onClick={() => { setShowKickConfirm(!showKickConfirm); setShowEntryForm(false); setShowWarnForm(false); }}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30
                                 text-sm font-medium px-4 py-2 rounded-lg transition"
                    >
                      Rauswerfen
                    </button>
                  )}
                </div>
              )}

              {/* Eintrag Formular */}
              {showEntryForm && (
                <div className="bg-[#0f1117] rounded-xl p-4 space-y-3">
                  <h4 className="text-white font-medium text-sm">Neuer Eintrag</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEntryForm(p => ({ ...p, type: 'misconduct' }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition
                        ${entryForm.type === 'misconduct'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : 'bg-white/5 text-gray-400 border-white/10'}`}
                    >
                      Fehlverhalten
                    </button>
                    <button
                      onClick={() => setEntryForm(p => ({ ...p, type: 'positive' }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition
                        ${entryForm.type === 'positive'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : 'bg-white/5 text-gray-400 border-white/10'}`}
                    >
                      Kein Fehlverhalten
                    </button>
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
                    Der Account wird deaktiviert.
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

              {/* Verwarnungen Liste */}
              {warnings.length > 0 && (
                <div>
                  <h4 className="text-white font-medium text-sm mb-2">
                    Verwarnungen ({warnings.length})
                  </h4>
                  <div className="space-y-2">
                    {warnings.map(w => (
                      <div key={w.id} className="bg-[#0f1117] rounded-lg p-3 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-yellow-400 text-sm">{w.reason}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            von {(w.creator as any)?.username} · {new Date(w.created_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        {myRole && (can as any).deleteEntries(myRole) && (
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

              {/* Einträge Liste */}
              {entries.length > 0 && (
                <div>
                  <h4 className="text-white font-medium text-sm mb-2">
                    Einträge ({entries.length})
                  </h4>
                  <div className="space-y-2">
                    {entries.map(e => (
                      <div key={e.id} className="bg-[#0f1117] rounded-lg p-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded border
                              ${e.type === 'misconduct'
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : 'bg-green-500/10 text-green-400 border-green-500/30'
                              }`}>
                              {e.type === 'misconduct' ? 'Fehlverhalten' : 'Kein Fehlverhalten'}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm">{e.text}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            von {(e.creator as any)?.username} · {new Date(e.created_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        {myRole && (can as any).deleteEntries(myRole) && (
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