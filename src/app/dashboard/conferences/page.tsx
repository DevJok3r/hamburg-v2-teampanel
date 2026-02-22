'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Conference, ConferenceAttendance, Profile, UserRole, AttendanceStatus } from '@/types';
import { can } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';

const STATUS_STYLES = {
  scheduled:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  active:     'bg-green-500/10 text-green-400 border-green-500/30',
  completed:  'bg-gray-500/10 text-gray-400 border-gray-500/30',
  cancelled:  'bg-red-500/10 text-red-400 border-red-500/30',
};

const STATUS_LABELS = {
  scheduled: 'Geplant',
  active:    'Aktiv',
  completed: 'Abgeschlossen',
  cancelled: 'Abgesagt',
};

const ATTENDANCE_STYLES = {
  present: 'bg-green-500/10 text-green-400 border-green-500/30',
  excused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  absent:  'bg-red-500/10 text-red-400 border-red-500/30',
};

const ATTENDANCE_LABELS = {
  present: 'Anwesend',
  excused: 'Entschuldigt',
  absent:  'Abwesend',
};

export default function ConferencesPage() {
  const [conferences, setConferences]       = useState<Conference[]>([]);
  const [members, setMembers]               = useState<Profile[]>([]);
  const [myRole, setMyRole]                 = useState<UserRole | null>(null);
  const [myId, setMyId]                     = useState<string>('');
  const [loading, setLoading]               = useState(true);
  const [showForm, setShowForm]             = useState(false);
  const [editConference, setEditConference] = useState<Conference | null>(null);
  const [activeAttendance, setActiveAttendance] = useState<{
    conference: Conference;
    attendance: ConferenceAttendance[];
  } | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', scheduled_at: '',
  });

  const [editForm, setEditForm] = useState({
    title: '', description: '', scheduled_at: '',
  });

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

    const { data: confs } = await supabase
      .from('conferences')
      .select('*, profiles!conferences_created_by_fkey(username, role)')
      .order('scheduled_at', { ascending: false });

    const { data: allMembers } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('username');

    setConferences(confs || []);
    setMembers(allMembers || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const canManage = myRole ? can.createUser(myRole) : false;

  async function createConference() {
    if (!form.title.trim() || !form.scheduled_at) return;
    await supabase.from('conferences').insert({
      title: form.title,
      description: form.description || null,
      scheduled_at: form.scheduled_at,
      created_by: myId,
    });
    setForm({ title: '', description: '', scheduled_at: '' });
    setShowForm(false);
    load();
  }

  async function saveEdit() {
    if (!editConference) return;
    await supabase.from('conferences').update({
      title: editForm.title,
      description: editForm.description || null,
      scheduled_at: editForm.scheduled_at,
    }).eq('id', editConference.id);
    setEditConference(null);
    load();
  }

  async function cancelConference(id: string) {
    await supabase.from('conferences')
      .update({ status: 'cancelled' })
      .eq('id', id);
    load();
  }

  async function rescheduleConference(id: string, newDate: string) {
    await supabase.from('conferences')
      .update({ scheduled_at: newDate, status: 'scheduled' })
      .eq('id', id);
    load();
  }

  async function startConference(conference: Conference) {
    // Status auf aktiv setzen
    await supabase.from('conferences')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', conference.id);

    // Anwesenheitsliste für alle Mitglieder erstellen
    const attendanceRows = members.map(m => ({
      conference_id: conference.id,
      user_id: m.id,
      status: 'absent' as AttendanceStatus,
    }));

    await supabase.from('conference_attendance')
      .upsert(attendanceRows, { onConflict: 'conference_id,user_id' });

    // Anwesenheitsliste laden
    const { data: attendance } = await supabase
      .from('conference_attendance')
      .select('*, profiles!conference_attendance_user_id_fkey(username, role)')
      .eq('conference_id', conference.id);

    const updatedConference = { ...conference, status: 'active' as const };
    setActiveAttendance({ conference: updatedConference, attendance: attendance || [] });
    load();
  }

  async function updateAttendance(conferenceId: string, userId: string, status: AttendanceStatus) {
    await supabase.from('conference_attendance')
      .update({ status })
      .eq('conference_id', conferenceId)
      .eq('user_id', userId);

    setActiveAttendance(prev => {
      if (!prev) return null;
      return {
        ...prev,
        attendance: prev.attendance.map(a =>
          a.user_id === userId ? { ...a, status } : a
        ),
      };
    });
  }

  async function endConference(id: string) {
    await supabase.from('conferences')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', id);
    setActiveAttendance(null);
    load();
  }

  async function deleteConference(id: string) {
    await supabase.from('conferences').delete().eq('id', id);
    load();
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Konferenzen</h1>
          <p className="text-gray-400 text-sm mt-1">{conferences.length} Konferenzen gesamt</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg
                       transition text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Konferenz ankündigen
          </button>
        )}
      </div>

      {/* Neue Konferenz Formular */}
      {showForm && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-medium">Neue Konferenz ankündigen</h3>
          <input
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Titel der Konferenz..."
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                       text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Beschreibung (optional)..."
            rows={2}
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                       text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Datum & Uhrzeit</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
              className="bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                         focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)}
              className="bg-white/5 hover:bg-white/10 text-gray-300 font-medium px-4 py-2 rounded-lg transition text-sm">
              Abbrechen
            </button>
            <button onClick={createConference}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition text-sm">
              Ankündigen
            </button>
          </div>
        </div>
      )}

      {/* Anwesenheitsliste Modal */}
      {activeAttendance && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-bold text-lg">{activeAttendance.conference.title}</h2>
                <p className="text-green-400 text-sm">Konferenz läuft</p>
              </div>
              <button
                onClick={() => endConference(activeAttendance.conference.id)}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30
                           font-medium px-4 py-2 rounded-lg transition text-sm"
              >
                Konferenz beenden
              </button>
            </div>

            <h3 className="text-gray-400 text-sm font-medium mb-3">Anwesenheitsliste</h3>
            <div className="space-y-2">
              {activeAttendance.attendance.map(a => (
                <div key={a.user_id}
                  className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full
                                    flex items-center justify-center text-white font-bold text-xs">
                      {a.profiles?.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{a.profiles?.username}</p>
                      {a.profiles?.role && <RoleBadge role={a.profiles.role as UserRole} size="xs" />}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(['present', 'excused', 'absent'] as AttendanceStatus[]).map(status => (
                      <button
                        key={status}
                        onClick={() => updateAttendance(activeAttendance.conference.id, a.user_id, status)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition
                          ${a.status === status
                            ? ATTENDANCE_STYLES[status]
                            : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10'
                          }`}
                      >
                        {ATTENDANCE_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Konferenz bearbeiten Modal */}
      {editConference && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-5">Konferenz bearbeiten</h2>
            <div className="space-y-4">
              <input
                value={editForm.title}
                onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Titel..."
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                           text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Beschreibung..."
                rows={2}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                           text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Datum & Uhrzeit</label>
                <input
                  type="datetime-local"
                  value={editForm.scheduled_at}
                  onChange={e => setEditForm(p => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2
                             text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditConference(null)}
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

      {/* Konferenz Liste */}
      {loading ? (
        <div className="text-gray-400 text-center py-12">Lade...</div>
      ) : (
        <div className="space-y-3">
          {conferences.map(conf => (
            <div key={conf.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-semibold">{conf.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[conf.status]}`}>
                      {STATUS_LABELS[conf.status]}
                    </span>
                  </div>
                  {conf.description && (
                    <p className="text-gray-400 text-sm mb-2">{conf.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      📅 {new Date(conf.scheduled_at).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {conf.profiles && (
                      <span>👤 {conf.profiles.username}</span>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    {conf.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => startConference(conf)}
                          className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border
                                     border-green-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                        >
                          Starten
                        </button>
                        <button
                          onClick={() => {
                            setEditConference(conf);
                            setEditForm({
                              title: conf.title,
                              description: conf.description || '',
                              scheduled_at: conf.scheduled_at.slice(0, 16),
                            });
                          }}
                          className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border
                                     border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => cancelConference(conf.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border
                                     border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                        >
                          Absagen
                        </button>
                      </>
                    )}
                    {conf.status === 'active' && (
                      <button
                        onClick={() => startConference(conf)}
                        className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border
                                   border-green-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                      >
                        Anwesenheit
                      </button>
                    )}
                    {(conf.status === 'completed' || conf.status === 'cancelled') && (
                      <button
                        onClick={() => deleteConference(conf.id)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border
                                   border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {conferences.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Keine Konferenzen geplant
            </div>
          )}
        </div>
      )}
    </div>
  );
}