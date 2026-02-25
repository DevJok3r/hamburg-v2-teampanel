'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can } from '@/lib/permissions';
import { useRouter } from 'next/navigation';

interface DeptApplication {
  id: string;
  department: 'moderation' | 'social_media' | 'event' | 'development';
  ingame_name: string;
  discord_tag: string;
  age: number;
  timezone: string;
  availability: string;
  experience: string;
  motivation: string;
  extra_q1: string | null;
  extra_q2: string | null;
  extra_q3: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const DEPT_LABELS: Record<string, string> = {
  moderation: 'Moderation Team', social_media: 'Social Media Team',
  event: 'Event Team', development: 'Development Team',
};

const DEPT_COLORS: Record<string, string> = {
  moderation:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  social_media:'bg-purple-500/10 text-purple-400 border-purple-500/30',
  event:       'bg-pink-500/10 text-pink-400 border-pink-500/30',
  development: 'bg-green-500/10 text-green-400 border-green-500/30',
};

const STATUS_STYLES = {
  pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const STATUS_LABELS = { pending: 'Ausstehend', approved: 'Angenommen', rejected: 'Abgelehnt' };

const DEPT_QUESTIONS: Record<string, string[]> = {
  moderation:   ['Wie gehst du mit einem toxischen Spieler um?', 'Erfahrung als Moderator?', 'Reaktion wenn Entscheidung angefochten wird?'],
  social_media: ['Erfahrung mit Social Media Plattformen?', 'Bisheriger Content?', 'Genutzte Tools?'],
  event:        ['Bisherige Events organisiert?', 'Umgang wenn Event nicht läuft?', 'Kreativste Event-Idee?'],
  development:  ['Programmiersprachen & Technologien?', 'Bisherige Projekte?', 'Vorgehensweise beim Debugging?'],
};

export default function DeptApplicationsPage() {
  const [applications, setApplications] = useState<DeptApplication[]>([]);
  const [myRole, setMyRole]             = useState<UserRole | null>(null);
  const [myId, setMyId]                 = useState<string>('');
  const [loading, setLoading]           = useState(true);
  const [selectedApp, setSelectedApp]   = useState<DeptApplication | null>(null);
  const [reviewNote, setReviewNote]     = useState('');
  const [filterDept, setFilterDept]     = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !can.viewAdmin(profile.role as UserRole)) { router.push('/dashboard'); return; }
    setMyRole(profile.role as UserRole);
    const { data } = await supabase.from('department_applications').select('*').order('created_at', { ascending: false });
    setApplications(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function reviewApplication(id: string, status: 'approved' | 'rejected') {
    await supabase.from('department_applications').update({
      status, review_note: reviewNote || null,
      reviewed_by: myId, reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    setSelectedApp(null);
    setReviewNote('');
    load();
  }

  async function deleteApplication(id: string) {
    await supabase.from('department_applications').delete().eq('id', id);
    setSelectedApp(null);
    load();
  }

  const filtered = applications.filter(a =>
    (filterDept === 'all' || a.department === filterDept) &&
    (filterStatus === 'all' || a.status === filterStatus)
  );

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Bewerbungen</h1>
        <p className="text-gray-400 text-sm mt-1">{applications.length} Bewerbungen gesamt</p>
      </div>

      {/* Bewerbungslinks */}
      <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
        <h3 className="text-white font-medium mb-3">Bewerbungslinks teilen</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(DEPT_LABELS).map(([key, label]) => (
            <div key={key} className="bg-[#0f1117] rounded-lg p-3 flex items-center justify-between gap-3">
              <div>
                <p className={`text-xs font-medium ${DEPT_COLORS[key].split(' ')[1]}`}>{label}</p>
                <p className="text-gray-600 text-xs font-mono mt-0.5 truncate">{BASE_URL}/apply/{key}</p>
              </div>
              <button onClick={() => navigator.clipboard.writeText(`${BASE_URL}/apply/${key}`)}
                className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition flex-shrink-0">
                Kopieren
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1a1d27] border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{applications.filter(a => a.status === 'pending').length}</p>
          <p className="text-gray-400 text-xs mt-1">Ausstehend</p>
        </div>
        <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{applications.filter(a => a.status === 'approved').length}</p>
          <p className="text-gray-400 text-xs mt-1">Angenommen</p>
        </div>
        <div className="bg-[#1a1d27] border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{applications.filter(a => a.status === 'rejected').length}</p>
          <p className="text-gray-400 text-xs mt-1">Abgelehnt</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-2">
          {['all', 'moderation', 'social_media', 'event', 'development'].map(d => (
            <button key={d} onClick={() => setFilterDept(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${filterDept === d ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              {d === 'all' ? 'Alle Abteilungen' : DEPT_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {['all', 'pending', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition
                ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              {s === 'all' ? 'Alle Status' : STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
            </button>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">{selectedApp.ingame_name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded border ${DEPT_COLORS[selectedApp.department]}`}>
                    {DEPT_LABELS[selectedApp.department]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[selectedApp.status]}`}>
                    {STATUS_LABELS[selectedApp.status]}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-gray-400 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Basis Info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Discord', value: selectedApp.discord_tag },
                  { label: 'Alter', value: `${selectedApp.age} Jahre` },
                  { label: 'Zeitzone', value: selectedApp.timezone },
                  { label: 'Verfügbarkeit', value: selectedApp.availability },
                ].map(item => (
                  <div key={item.label} className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">{item.label}</p>
                    <p className="text-white text-sm">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Erfahrung & Motivation */}
              {[
                { label: 'Bisherige Erfahrungen', value: selectedApp.experience },
                { label: 'Motivation', value: selectedApp.motivation },
              ].map(item => (
                <div key={item.label} className="bg-[#0f1117] rounded-lg p-4">
                  <p className="text-gray-400 text-xs font-medium mb-2">{item.label}</p>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{item.value}</p>
                </div>
              ))}

              {/* Abteilungsfragen */}
              {DEPT_QUESTIONS[selectedApp.department]?.map((q, i) => {
                const val = selectedApp[`extra_q${i + 1}` as keyof DeptApplication] as string | null;
                return val ? (
                  <div key={i} className="bg-[#0f1117] rounded-lg p-4">
                    <p className="text-gray-400 text-xs font-medium mb-2">{q}</p>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{val}</p>
                  </div>
                ) : null;
              })}

              <p className="text-gray-500 text-xs">
                Eingegangen am {new Date(selectedApp.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>

              {/* Review */}
              {selectedApp.status === 'pending' && myRole && can.createUser(myRole) && (
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                    placeholder="Anmerkung zur Entscheidung (optional)..." rows={2}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => deleteApplication(selectedApp.id)}
                      className="bg-white/5 hover:bg-white/10 text-gray-400 text-sm px-4 py-2 rounded-lg transition">
                      Löschen
                    </button>
                    <button onClick={() => reviewApplication(selectedApp.id, 'rejected')}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium text-sm px-4 py-2 rounded-lg transition">
                      Ablehnen
                    </button>
                    <button onClick={() => reviewApplication(selectedApp.id, 'approved')}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium text-sm px-5 py-2 rounded-lg transition">
                      Annehmen
                    </button>
                  </div>
                </div>
              )}

              {selectedApp.review_note && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Anmerkung</p>
                  <p className="text-gray-300 text-sm">{selectedApp.review_note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Keine Bewerbungen vorhanden</div>
        ) : filtered.map(app => (
          <div key={app.id} onClick={() => setSelectedApp(app)}
            className="bg-[#1a1d27] border border-white/10 hover:border-blue-500/30 rounded-xl p-5 cursor-pointer transition">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {app.ingame_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{app.ingame_name}</p>
                  <p className="text-gray-500 text-xs">{app.discord_tag}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded border ${DEPT_COLORS[app.department]}`}>
                  {DEPT_LABELS[app.department]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[app.status]}`}>
                  {STATUS_LABELS[app.status]}
                </span>
                <span className="text-gray-500 text-xs">
                  {new Date(app.created_at).toLocaleDateString('de-DE')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}