'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Absence, UserRole } from '@/types';
import { can } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';

const STATUS_STYLES = {
  pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
};
const STATUS_LABELS = { pending: 'Ausstehend', approved: 'Genehmigt', rejected: 'Abgelehnt' };

export default function AbsencesPage() {
  const [absences, setAbsences]         = useState<Absence[]>([]);
  const [myRole, setMyRole]             = useState<UserRole | null>(null);
  const [myId, setMyId]                 = useState<string>('');
  const [showForm, setShowForm]         = useState(false);
  const [editAbsence, setEditAbsence]   = useState<Absence | null>(null);
  const [form, setForm]                 = useState({ from_date: '', to_date: '', reason: '' });
  const [editForm, setEditForm]         = useState({ from_date: '', to_date: '', reason: '' });
  const [loading, setLoading]           = useState(true);

  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) setMyRole(profile.role as UserRole);

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
      user_id: myId,
      from_date: form.from_date,
      to_date: form.to_date,
      reason: form.reason,
    });
    setForm({ from_date: '', to_date: '', reason: '' });
    setShowForm(false);
    load();
  }

  async function saveEdit() {
    if (!editAbsence) return;
    await supabase.from('absences').update({
      from_date: editForm.from_date,
      to_date: editForm.to_date,
      reason: editForm.reason,
    }).eq('id', editAbsence.id);
    setEditAbsence(null);
    load();
  }

  async function deleteAbsence(id: string) {
    await supabase.from('absences').delete().eq('id', id);
    load();
  }

  async function reviewAbsence(id: string, status: 'approved' | 'rejected') {
    await supabase.from('absences').update({
      status,
      reviewed_by: myId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    load();
  }

  const canReview = myRole ? can.reviewAbsence(myRole) : false;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Abmeldungen</h1>
          <p className="text-gray-400 text-sm mt-1">
            {canReview ? 'Alle Abmeldungen' : 'Deine Abmeldungen'}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg
                     transition text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Abmeldung eintragen
        </button>
      </div>

      {/* Neue Abmeldung */}
      {showForm && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-medium">Neue Abmeldung</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Von</label>
              <input type="datetime-local" value={form.from_date}
                onChange={e => setForm(p => ({ ...p, from_date: e.target.value }))}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Bis</label>
              <input type="datetime-local" value={form.to_date}
                onChange={e => setForm(p => ({ ...p, to_date: e.target.value }))}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5
                           text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <textarea
            value={form.reason}
            onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            placeholder="Grund der Abmeldung..."
            rows={3}
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                       text-white placeholder-gray-500 text-sm focus:outline-none
                       focus:border-blue-500 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)}
              className="bg-white/5 hover:bg-white/10 text-gray-300 font-medium px-4 py-2 rounded-lg transition text-sm">
              Abbrechen
            </button>
            <button onClick={submitAbsence}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition text-sm">
              Eintragen
            </button>
          </div>
        </div>
      )}

      {/* Abmeldung bearbeiten Modal */}
      {editAbsence && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-5">Abmeldung bearbeiten</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Von</label>
                  <input type="datetime-local" value={editForm.from_date}
                    onChange={e => setEditForm(p => ({ ...p, from_date: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Bis</label>
                  <input type="datetime-local" value={editForm.to_date}
                    onChange={e => setEditForm(p => ({ ...p, to_date: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <textarea
                value={editForm.reason}
                onChange={e => setEditForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Grund..."
                rows={3}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                           text-white placeholder-gray-500 text-sm focus:outline-none
                           focus:border-blue-500 resize-none"
              />
              <div className="flex justify-end gap-2 pt-2">
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
        </div>
      )}

      {/* Abmeldungs-Liste */}
      {loading ? (
        <div className="text-gray-400 text-center py-12">Lade...</div>
      ) : (
        <div className="space-y-3">
          {absences.map(absence => (
            <div key={absence.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {canReview && absence.profiles && (
                      <>
                        <span className="text-white font-medium text-sm">
                          {absence.profiles.username}
                        </span>
                        <RoleBadge role={absence.profiles.role as UserRole} size="xs" />
                      </>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[absence.status]}`}>
                      {STATUS_LABELS[absence.status]}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{absence.reason}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Von: {new Date(absence.from_date).toLocaleString('de-DE', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}</span>
                    <span>Bis: {new Date(absence.to_date).toLocaleString('de-DE', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  {/* Bearbeiten – eigene pending Abmeldung oder Management */}
                  {(absence.user_id === myId && absence.status === 'pending') || canReview ? (
                    <button
                      onClick={() => {
                        setEditAbsence(absence);
                        setEditForm({
                          from_date: absence.from_date.slice(0, 16),
                          to_date: absence.to_date.slice(0, 16),
                          reason: absence.reason,
                        });
                      }}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border
                                 border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                    >
                      Bearbeiten
                    </button>
                  ) : null}

                  {/* Review Buttons */}
                  {canReview && absence.status === 'pending' && absence.user_id !== myId && (
                    <>
                      <button onClick={() => reviewAbsence(absence.id, 'approved')}
                        className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border
                                   border-green-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                        Genehmigen
                      </button>
                      <button onClick={() => reviewAbsence(absence.id, 'rejected')}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border
                                   border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                        Ablehnen
                      </button>
                    </>
                  )}

                  {/* Löschen – eigene oder Management */}
                  {(absence.user_id === myId || canReview) && (
                    <button
                      onClick={() => deleteAbsence(absence.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border
                                 border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {absences.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Keine Abmeldungen eingetragen
            </div>
          )}
        </div>
      )}
    </div>
  );
}