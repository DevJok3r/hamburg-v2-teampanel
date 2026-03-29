'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { isStaff } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';

const STATUS_CONFIG = {
  pending:  { label: 'Ausstehend', icon: '⏳', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', border: 'border-l-yellow-500' },
  approved: { label: 'Genehmigt',  icon: '✅', color: 'text-green-400 bg-green-500/10 border-green-500/30',   border: 'border-l-green-500' },
  rejected: { label: 'Abgelehnt',  icon: '❌', color: 'text-red-400 bg-red-500/10 border-red-500/30',          border: 'border-l-red-500' },
  expired:  { label: 'Abgelaufen', icon: '🕓', color: 'text-gray-400 bg-gray-500/10 border-gray-500/30',       border: 'border-l-gray-600' },
};

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'expired';

function isExpired(absence: any): boolean {
  return new Date(absence.to_date) < new Date() && absence.status !== 'rejected';
}

function getDuration(from: string, to: string): string {
  const diff = new Date(to).getTime() - new Date(from).getTime();
  const hours = Math.floor(diff / 1000 / 60 / 60);
  const days  = Math.floor(hours / 24);
  if (days >= 1) return `${days} Tag${days !== 1 ? 'e' : ''}`;
  return `${hours} Std.`;
}

function isCurrentlyActive(absence: any): boolean {
  const now = new Date();
  return new Date(absence.from_date) <= now && new Date(absence.to_date) >= now && absence.status === 'approved';
}

export default function AbsencesPage() {
  const [absences, setAbsences]         = useState<any[]>([]);
  const [myRole, setMyRole]             = useState<UserRole | null>(null);
  const [myId, setMyId]                 = useState('');
  const [myUsername, setMyUsername]     = useState('');
  const [showForm, setShowForm]         = useState(false);
  const [editAbsence, setEditAbsence]   = useState<any | null>(null);
  const [selectedAbsence, setSelectedAbsence] = useState<any | null>(null);
  const [form, setForm]                 = useState({ from_date: '', to_date: '', reason: '' });
  const [editForm, setEditForm]         = useState({ from_date: '', to_date: '', reason: '' });
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('pending');
  const [search, setSearch]             = useState('');

  const supabase = createClientSupabaseClient();

  async function fireAutomation(trigger: string, data: Record<string, string>) {
    try {
      await fetch('/api/automations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger, data }),
      });
    } catch {}
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
    if (profile) { setMyRole(profile.role as UserRole); setMyUsername(profile.username); }
    const { data } = await supabase
      .from('absences')
      .select('*, profiles!absences_user_id_fkey(username, role)')
      .order('created_at', { ascending: false });
    setAbsences(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getEffectiveStatus(absence: any): keyof typeof STATUS_CONFIG {
    if (absence.status === 'rejected') return 'rejected';
    if (isExpired(absence)) return 'expired';
    return absence.status;
  }

  async function submitAbsence() {
    if (!form.from_date || !form.to_date || !form.reason.trim()) return;
    if (!form.from_date || !form.to_date) {
  alert('Bitte Von- und Bis-Datum angeben.'); return;
}
if (new Date(form.from_date) > new Date(form.to_date)) {
  alert('Das Von-Datum darf nicht nach dem Bis-Datum liegen.'); return;
}
    await supabase.from('absences').insert({
      user_id: myId, from_date: form.from_date, to_date: form.to_date, reason: form.reason,
    });
    await fireAutomation('absence_created', {
      mitglied: myUsername,
      von:   new Date(form.from_date).toLocaleString('de-DE'),
      bis:   new Date(form.to_date).toLocaleString('de-DE'),
      grund: form.reason,
    });
    setForm({ from_date: '', to_date: '', reason: '' });
    setShowForm(false);
    load();
  }

  async function saveEdit() {
    if (!editAbsence) return;
    await supabase.from('absences').update({
      from_date: editForm.from_date, to_date: editForm.to_date, reason: editForm.reason,
    }).eq('id', editAbsence.id);
    setEditAbsence(null);
    setSelectedAbsence(null);
    load();
  }

  async function deleteAbsence(id: string) {
    if (!confirm('Abmeldung wirklich löschen?')) return;
    const absence = absences.find(a => a.id === id);
    await supabase.from('absences').delete().eq('id', id);
    await fireAutomation('absence_deleted', {
      mitglied: absence?.profiles?.username || '',
      grund:    absence?.reason || '',
    });
    setSelectedAbsence(null);
    load();
  }

  async function reviewAbsence(id: string, status: 'approved' | 'rejected') {
    const absence = absences.find(a => a.id === id);
    await supabase.from('absences').update({
      status, reviewed_by: myId, reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    await fireAutomation(status === 'approved' ? 'absence_approved' : 'absence_rejected', {
      mitglied: absence?.profiles?.username || '',
      von:    absence ? new Date(absence.from_date).toLocaleString('de-DE') : '',
      bis:    absence ? new Date(absence.to_date).toLocaleString('de-DE') : '',
      grund:  absence?.reason || '',
      status: status === 'approved' ? 'Genehmigt' : 'Abgelehnt',
    });
    setSelectedAbsence(null);
    load();
  }

  const canReview = myRole ? isStaff(myRole) : false;
  const canDelete = myRole ? isStaff(myRole) : false;
  const canEdit   = myRole ? isStaff(myRole) : false;

  const withStatus = useMemo(() =>
    absences.map(a => ({ ...a, effectiveStatus: getEffectiveStatus(a) })),
    [absences]
  );

  const counts = useMemo(() => ({
    all:      withStatus.length,
    pending:  withStatus.filter(a => a.effectiveStatus === 'pending').length,
    approved: withStatus.filter(a => a.effectiveStatus === 'approved').length,
    rejected: withStatus.filter(a => a.effectiveStatus === 'rejected').length,
    expired:  withStatus.filter(a => a.effectiveStatus === 'expired').length,
    active:   withStatus.filter(a => isCurrentlyActive(a)).length,
  }), [withStatus]);

  const filtered = useMemo(() => withStatus.filter(a => {
    const matchStatus = filterStatus === 'all' ? true : a.effectiveStatus === filterStatus;
    const matchSearch = !search || a.profiles?.username?.toLowerCase().includes(search.toLowerCase()) || a.reason?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }), [withStatus, filterStatus, search]);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  const TABS: { key: StatusFilter; label: string; icon: string }[] = [
    { key: 'all',      label: 'Alle',        icon: '📋' },
    { key: 'pending',  label: 'Ausstehend',  icon: '⏳' },
    { key: 'approved', label: 'Genehmigt',   icon: '✅' },
    { key: 'rejected', label: 'Abgelehnt',   icon: '❌' },
    { key: 'expired',  label: 'Abgelaufen',  icon: '🕓' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Abmeldungen</h1>
          <p className="text-gray-400 text-sm mt-1">
            {counts.active > 0
              ? <span className="text-green-400 font-medium">🟢 {counts.active} aktuell abwesend</span>
              : 'Abwesenheitsverwaltung'}
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Abmeldung eintragen
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#1a1d27] border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{counts.pending}</p>
          <p className="text-gray-400 text-xs mt-1">Ausstehend</p>
        </div>
        <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{counts.approved}</p>
          <p className="text-gray-400 text-xs mt-1">Genehmigt</p>
        </div>
        <div className="bg-[#1a1d27] border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{counts.rejected}</p>
          <p className="text-gray-400 text-xs mt-1">Abgelehnt</p>
        </div>
        <div className="bg-[#1a1d27] border border-gray-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-400">{counts.expired}</p>
          <p className="text-gray-400 text-xs mt-1">Abgelaufen</p>
        </div>
      </div>

      {/* TABS + SUCHE */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-1 bg-[#1a1d27] border border-white/10 rounded-xl p-1 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${filterStatus === tab.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {tab.icon} {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${filterStatus === tab.key ? 'bg-white/20' : 'bg-white/10 text-gray-500'}`}>
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Suchen..."
          className="bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 w-44" />
      </div>

      {/* LISTE */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 bg-[#1a1d27] border border-white/10 rounded-xl">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400 text-sm">Keine Abmeldungen in dieser Kategorie</p>
          </div>
        )}
        {filtered.map(absence => {
          const effStatus = absence.effectiveStatus as keyof typeof STATUS_CONFIG;
          const statusCf  = STATUS_CONFIG[effStatus];
          const active    = isCurrentlyActive(absence);
          const duration  = getDuration(absence.from_date, absence.to_date);

          return (
            <div key={absence.id} onClick={() => setSelectedAbsence(absence)}
              className={`bg-[#1a1d27] border border-white/10 border-l-4 ${statusCf.border} rounded-xl p-5 cursor-pointer hover:border-white/20 hover:bg-[#1e2130] transition`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {absence.profiles?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-white font-semibold text-sm">{absence.profiles?.username}</span>
                      {absence.profiles?.role && <RoleBadge role={absence.profiles.role as UserRole} size="xs" />}
                      {active && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium animate-pulse">🟢 Aktuell abwesend</span>}
                    </div>
                    <p className="text-gray-300 text-sm line-clamp-1">{absence.reason}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-gray-500">
                      <span>📅 {new Date(absence.from_date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>→ {new Date(absence.to_date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-gray-600">⏱ {duration}</span>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded border font-medium ${statusCf.color}`}>
                    {statusCf.icon} {statusCf.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Neue Abmeldung</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Von</label>
                  <input type="datetime-local" value={form.from_date}
                    onChange={e => setForm(p => ({ ...p, from_date: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Bis</label>
                  <input type="datetime-local" value={form.to_date}
                    onChange={e => setForm(p => ({ ...p, to_date: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              {form.from_date && form.to_date && new Date(form.to_date) > new Date(form.from_date) && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2 text-blue-300 text-xs">
                  ⏱ Dauer: {getDuration(form.from_date, form.to_date)}
                </div>
              )}
              <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Grund der Abmeldung..." rows={3}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg text-sm transition">
                  Abbrechen
                </button>
                <button onClick={submitAbsence}
                  disabled={!form.from_date || !form.to_date || !form.reason.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition">
                  📤 Eintragen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editAbsence && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Abmeldung bearbeiten</h2>
              <button onClick={() => setEditAbsence(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Von</label>
                  <input type="datetime-local" value={editForm.from_date}
                    onChange={e => setEditForm(p => ({ ...p, from_date: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Bis</label>
                  <input type="datetime-local" value={editForm.to_date}
                    onChange={e => setEditForm(p => ({ ...p, to_date: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              {editForm.from_date && editForm.to_date && new Date(editForm.to_date) > new Date(editForm.from_date) && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2 text-blue-300 text-xs">
                  ⏱ Dauer: {getDuration(editForm.from_date, editForm.to_date)}
                </div>
              )}
              <textarea value={editForm.reason} onChange={e => setEditForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Grund..." rows={3}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setEditAbsence(null)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg text-sm transition">
                  Abbrechen
                </button>
                <button onClick={saveEdit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition">
                  💾 Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedAbsence && (() => {
        const a         = selectedAbsence;
        const effStatus = a.effectiveStatus as keyof typeof STATUS_CONFIG;
        const statusCf  = STATUS_CONFIG[effStatus];
        const active    = isCurrentlyActive(a);
        const duration  = getDuration(a.from_date, a.to_date);
        const canDel    = canDelete || (a.user_id === myId && a.status === 'pending');
        const canEd     = canEdit   || (a.user_id === myId && a.status === 'pending');

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`bg-[#1a1d27] border border-white/10 border-l-4 ${statusCf.border} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {a.profiles?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-bold">{a.profiles?.username}</p>
                    {a.profiles?.role && <RoleBadge role={a.profiles.role as UserRole} size="xs" />}
                  </div>
                </div>
                <button onClick={() => setSelectedAbsence(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
              </div>

              <div className="p-6 space-y-4">
                {active && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="animate-pulse text-lg">🟢</span>
                    <p className="text-green-400 text-sm font-medium">Diese Person ist aktuell abwesend</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Status</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusCf.color}`}>
                      {statusCf.icon} {statusCf.label}
                    </span>
                  </div>
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Dauer</p>
                    <p className="text-white text-sm font-medium">⏱ {duration}</p>
                  </div>
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Von</p>
                    <p className="text-white text-sm">{new Date(a.from_date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Bis</p>
                    <p className="text-white text-sm">{new Date(a.to_date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                <div className="bg-[#0f1117] rounded-lg p-4">
                  <p className="text-gray-500 text-xs mb-1">Grund</p>
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{a.reason}</p>
                </div>

                {/* Review Buttons */}
                {canReview && a.user_id !== myId && effStatus !== 'expired' && (
                  <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                    <button onClick={() => reviewAbsence(a.id, 'rejected')}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium py-2.5 rounded-lg text-sm transition">
                      ❌ Ablehnen
                    </button>
                    <button onClick={() => reviewAbsence(a.id, 'approved')}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm transition">
                      ✅ Genehmigen
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  {canEd && effStatus !== 'expired' && (
                    <button onClick={() => {
                      setEditAbsence(a);
                      setEditForm({ from_date: a.from_date.slice(0, 16), to_date: a.to_date.slice(0, 16), reason: a.reason });
                      setSelectedAbsence(null);
                    }}
                      className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium py-2.5 rounded-lg text-sm transition">
                      ✏️ Bearbeiten
                    </button>
                  )}
                  {canDel && (
                    <button onClick={() => deleteAbsence(a.id)}
                      className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium py-2.5 rounded-lg text-sm transition">
                      🗑️ Löschen
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}