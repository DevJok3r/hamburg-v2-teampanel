'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Absence, UserRole } from '@/types';
import { can, isStaff } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';

const STATUS_STYLES = {
  pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
};
const STATUS_LABELS = { pending: 'Ausstehend', approved: 'Genehmigt', rejected: 'Abgelehnt' };

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function AbsencesPage() {
  const [absences, setAbsences]       = useState<any[]>([]);
  const [myRole, setMyRole]           = useState<UserRole | null>(null);
  const [myId, setMyId]               = useState<string>('');
  const [myUsername, setMyUsername]   = useState<string>('');
  const [showForm, setShowForm]       = useState(false);
  const [editAbsence, setEditAbsence] = useState<any | null>(null);
  const [form, setForm]               = useState({ from_date: '', to_date: '', reason: '' });
  const [editForm, setEditForm]       = useState({ from_date: '', to_date: '', reason: '' });
  const [loading, setLoading]         = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('pending');

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

  async function submitAbsence() {
    if (!form.from_date || !form.to_date || !form.reason.trim()) return;
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
    load();
  }

  async function deleteAbsence(id: string) {
    const absence = absences.find(a => a.id === id);
    await supabase.from('absences').delete().eq('id', id);
    await fireAutomation('absence_deleted', {
      mitglied: absence?.profiles?.username || '',
      grund:    absence?.reason || '',
    });
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
    load();
  }

  const canReview = myRole ? isStaff(myRole) : false;
  const canDelete = myRole ? isStaff(myRole) : false;
  const canEdit   = myRole ? isStaff(myRole) : false;

  const filtered = absences.filter(a =>
    filterStatus === 'all' ? true : a.status === filterStatus
  );

  const counts = {
    all:      absences.length,
    pending:  absences.filter(a => a.status === 'pending').length,
    approved: absences.filter(a => a.status === 'approved').length,
    rejected: absences.filter(a => a.status === 'rejected').length,
  };

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Abmeldungen</h1>
          <p className="text-gray-400 text-sm mt-1">{absences.length} Abmeldungen gesamt</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Abmeldung eintragen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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
      </div>

      {/* Neue Abmeldung Formular */}
      {showForm && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-medium">Neue Abmeldung</h3>
          <div className="grid grid-cols-2 gap-4">
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
          <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            placeholder="Grund der Abmeldung..." rows={3}
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)}
              className="bg-white/5 hover:bg-white/10 text-gray-300 font-medium px-4 py-2 rounded-lg transition text-sm">
              Abbrechen
            </button>
            <button onClick={submitAbsence} disabled={!form.from_date || !form.to_date || !form.reason.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg transition text-sm">
              Eintragen
            </button>
          </div>
        </div>
      )}

      {/* Bearbeiten Modal */}
      {editAbsence && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-white font-bold text-lg">Abmeldung bearbeiten</h2>
            <div className="grid grid-cols-2 gap-4">
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
            <textarea value={editForm.reason} onChange={e => setEditForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Grund..." rows={3}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditAbsence(null)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 font-medium px-4 py-2 rounded-lg transition text-sm">
                Abbrechen
              </button>
              <button onClick={saveEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition text-sm">
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all',      label: 'Alle' },
          { key: 'pending',  label: 'Ausstehend' },
          { key: 'approved', label: 'Genehmigt' },
          { key: 'rejected', label: 'Abgelehnt' },
        ] as { key: StatusFilter; label: string }[]).map(tab => (
          <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2
              ${filterStatus === tab.key ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterStatus === tab.key ? 'bg-white/20' : 'bg-white/10'}`}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Keine Abmeldungen vorhanden</div>
        ) : filtered.map(absence => (
          <div key={absence.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {absence.profiles?.username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white font-medium text-sm">{absence.profiles?.username}</span>
                  {absence.profiles?.role && <RoleBadge role={absence.profiles.role as UserRole} size="xs" />}
                  <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[absence.status as keyof typeof STATUS_STYLES]}`}>
                    {STATUS_LABELS[absence.status as keyof typeof STATUS_LABELS]}
                  </span>
                </div>
                <p className="text-gray-300 text-sm mb-2">{absence.reason}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  <span>Von: {new Date(absence.from_date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>Bis: {new Date(absence.to_date).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                {/* Genehmigen / Ablehnen – nur Staff, nur pending, nicht eigene */}
                {canReview && absence.status === 'pending' && absence.user_id !== myId && (
                  <>
                    <button onClick={() => reviewAbsence(absence.id, 'approved')}
                      className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                      Genehmigen
                    </button>
                    <button onClick={() => reviewAbsence(absence.id, 'rejected')}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                      Ablehnen
                    </button>
                  </>
                )}

                {/* Bearbeiten – Staff ODER eigene pending Abmeldung */}
                {(canEdit || (absence.user_id === myId && absence.status === 'pending')) && (
                  <button onClick={() => {
                    setEditAbsence(absence);
                    setEditForm({
                      from_date: absence.from_date.slice(0, 16),
                      to_date:   absence.to_date.slice(0, 16),
                      reason:    absence.reason,
                    });
                  }}
                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                    Bearbeiten
                  </button>
                )}

                {/* Löschen – Staff ODER eigene pending Abmeldung */}
                {(canDelete || (absence.user_id === myId && absence.status === 'pending')) && (
                  <button onClick={() => deleteAbsence(absence.id)}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                    Löschen
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}