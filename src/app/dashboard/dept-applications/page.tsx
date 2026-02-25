'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole, Profile } from '@/types';
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
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface AccessEntry {
  id: string;
  user_id: string;
  department: string;
  profiles?: { username: string; role: UserRole };
}

const DEPT_LABELS: Record<string, string> = {
  moderation: 'Moderation Team', social_media: 'Social Media Team',
  event: 'Event Team', development: 'Development Team',
};

const DEPT_COLORS: Record<string, string> = {
  moderation:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  social_media: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  event:        'bg-pink-500/10 text-pink-400 border-pink-500/30',
  development:  'bg-green-500/10 text-green-400 border-green-500/30',
};

const STATUS_STYLES = {
  pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
};
const STATUS_LABELS = { pending: 'Ausstehend', approved: 'Angenommen', rejected: 'Abgelehnt' };

// Deutsche Fragebeschriftungen pro Abteilung
const FIELD_LABELS: Record<string, Record<string, string>> = {
  moderation: {
    first_name: 'Vorname', discord_name: 'Discord Name', roblox_name: 'Roblox Name',
    age: 'Alter', strengths_weaknesses: 'Stärken & Schwächen',
    motivation: 'Warum Moderation Team?', why_you: 'Warum genau du?',
    has_experience: 'Erfahrung als Moderator?', three_words: '3 Wörter über dich',
    hours_per_day: 'Stunden pro Tag', active_times: 'Aktive Zeiten',
    situation_1: 'Situation: Ausfallender Spieler im Chat/Voice',
    situation_2: 'Situation: Mehrere Regelverstöße gleichzeitig',
    situation_3: 'Situation: Freund verstößt gegen Regeln',
    situation_4: 'Situation: Spieler streiten im Chat',
    situation_5: 'Situation: Spieler ficht Verwarnung an (Team-Report)',
    rules_accepted: 'Regelwerk akzeptiert?', extra_info: 'Weitere Mitteilungen',
  },
  social_media: {
    roblox_name: 'Roblox Name', discord_name: 'Discord Name', age: 'Alter',
    scale_grammar: 'Skala: Rechtschreibung & Grammatik (1-10)',
    scale_time: 'Skala: Genug Zeit für Content (1-10)',
    motivation: 'Warum Social Media Team?',
    has_experience: 'Erfahrung im Social Media Bereich?',
    tools: 'Genutzte Programme & Tools',
    strengths: 'Stärken für das Social Media Team',
    hours_per_week: 'Stunden pro Woche', active_times: 'Aktive Zeiten',
    portfolio: 'Portfolio / Arbeitsbeispiele (Link)',
    rules_accepted: 'Regelwerk akzeptiert?', extra_info: 'Weitere Mitteilungen',
  },
  event: {
    first_name: 'Name', roblox_name: 'Roblox Name', discord_name: 'Discord Name',
    training_team: 'Gewähltes Trainings-Team',
    team_knowledge: 'Wissen über das gewählte Team',
    team_experience: 'Eigene Erfahrung im gewählten Team',
    discord_id: 'Discord ID',
    training_concept: 'Trainingskonzept',
    good_trainer: 'Was macht einen guten Event Organizer aus?',
    age: 'Alter', motivation: 'Warum bist du perfekt geeignet?',
    has_microphone: 'Funktionierendes Mikrofon?',
    hours_per_week: 'Stunden pro Woche', active_times: 'Aktive Zeiten',
    rules_accepted: 'Regelwerk akzeptiert?', extra_info: 'Weitere Mitteilungen',
  },
  development: {
    first_name: 'Vorname & Alter', roblox_name: 'Roblox Name',
    discord_name: 'Discord Name & Discord ID',
    why_you: 'Warum bist du perfekt als Developer geeignet?',
    dev_experience: 'Erfahrungen im Development',
    dev_area: 'Bewerbungsbereich (Scripting/Building/etc.)',
    roblox_studio: 'Erfahrung mit Roblox Studio?',
    years_active: 'Wie lange im Development tätig?',
    portfolio: 'Vorherige Projekte (Link)',
    handle_criticism: 'Umgang mit Kritik',
    alone_or_team: 'Alleine oder im Team?',
    disagreement: 'Reaktion bei unterschiedlichen Meinungen',
    extra_info: 'Weitere Mitteilungen',
    time_motivation: 'Zeit & Motivation vorhanden?',
  },
};

export default function DeptApplicationsPage() {
  const [applications, setApplications]   = useState<DeptApplication[]>([]);
  const [myRole, setMyRole]               = useState<UserRole | null>(null);
  const [myId, setMyId]                   = useState<string>('');
  const [loading, setLoading]             = useState(true);
  const [selectedApp, setSelectedApp]     = useState<DeptApplication | null>(null);
  const [reviewNote, setReviewNote]       = useState('');
  const [filterDept, setFilterDept]       = useState<string>('all');
  const [filterStatus, setFilterStatus]   = useState<string>('pending');
  const [activeTab, setActiveTab]         = useState<'applications' | 'access'>('applications');
  const [accessList, setAccessList]       = useState<AccessEntry[]>([]);
  const [allMembers, setAllMembers]       = useState<Profile[]>([]);
  const [accessDept, setAccessDept]       = useState<string>('moderation');
  const [accessUser, setAccessUser]       = useState<string>('');
  const [myAccess, setMyAccess]           = useState<string[]>([]);
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile) { router.push('/dashboard'); return; }
    const role = profile.role as UserRole;
    if (!['top_management', 'management', 'junior_management'].includes(role)) { router.push('/dashboard'); return; }
    setMyRole(role);

    // Meine Zugriffsrechte laden
    if (role !== 'top_management') {
      const { data: access } = await supabase.from('application_access').select('department').eq('user_id', user.id);
      setMyAccess((access || []).map((a: any) => a.department));
    }

    const { data } = await supabase.from('department_applications').select('*').order('created_at', { ascending: false });
    setApplications(data || []);

    if (role === 'top_management') {
      const { data: al } = await supabase.from('application_access')
        .select('*, profiles!application_access_user_id_fkey(username, role)').order('department');
      setAccessList(al || []);
      const { data: members } = await supabase.from('profiles').select('*').eq('is_active', true)
        .not('role', 'eq', 'top_management').order('username');
      setAllMembers(members || []);
    }

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

  async function grantAccess() {
    if (!accessUser || !accessDept) return;
    await supabase.from('application_access').upsert({ user_id: accessUser, department: accessDept, granted_by: myId });
    setAccessUser('');
    load();
  }

  async function revokeAccess(id: string) {
    await supabase.from('application_access').delete().eq('id', id);
    load();
  }

  function canSeeDept(dept: string): boolean {
    if (myRole === 'top_management') return true;
    return myAccess.includes(dept);
  }

  const visibleApps = applications.filter(a => canSeeDept(a.department));
  const filtered = visibleApps.filter(a =>
    (filterDept === 'all' || a.department === filterDept) &&
    (filterStatus === 'all' || a.status === filterStatus)
  );

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

  function renderAnswers(app: DeptApplication) {
    if (!app.extra_q1) return null;
    try {
      const answers = JSON.parse(app.extra_q1);
      const labels = FIELD_LABELS[app.department] || {};
      return Object.entries(answers).map(([key, val]) => {
        if (!val || String(val).trim() === '') return null;
        const label = labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return (
          <div key={key} className="bg-[#0f1117] rounded-lg p-4">
            <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
            <p className="text-gray-300 text-sm whitespace-pre-wrap">{String(val)}</p>
          </div>
        );
      });
    } catch { return null; }
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Bewerbungen</h1>
        <p className="text-gray-400 text-sm mt-1">{visibleApps.length} Bewerbungen sichtbar</p>
      </div>

      {/* Bewerbungslinks – nur Top Management */}
      {myRole === 'top_management' && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
          <h3 className="text-white font-medium mb-3">Bewerbungslinks teilen</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(DEPT_LABELS).map(([key, label]) => (
              <div key={key} className="bg-[#0f1117] rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <p className={`text-xs font-medium ${DEPT_COLORS[key].split(' ')[1]}`}>{label}</p>
                  <p className="text-gray-600 text-xs font-mono mt-0.5">{BASE_URL}/apply/{key}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(`${BASE_URL}/apply/${key}`)}
                  className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition flex-shrink-0">
                  Kopieren
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveTab('applications')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'applications' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          Bewerbungen ({visibleApps.length})
        </button>
        {myRole === 'top_management' && (
          <button onClick={() => setActiveTab('access')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'access' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            Zugriffsrechte ({accessList.length})
          </button>
        )}
      </div>

      {/* Zugriffsrechte Tab */}
      {activeTab === 'access' && myRole === 'top_management' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-medium">Zugriff vergeben</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Abteilung</label>
                <select value={accessDept} onChange={e => setAccessDept(e.target.value)}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                  {Object.entries(DEPT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Mitglied</label>
                <select value={accessUser} onChange={e => setAccessUser(e.target.value)}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Mitglied wählen...</option>
                  {allMembers.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={grantAccess} disabled={!accessUser}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
                Zugriff vergeben
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {accessList.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">Keine Zugriffsrechte vergeben</div>
            ) : accessList.map(a => (
              <div key={a.id} className="bg-[#1a1d27] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                    {(a.profiles as any)?.username?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{(a.profiles as any)?.username}</p>
                    <span className={`text-xs px-2 py-0.5 rounded border ${DEPT_COLORS[a.department]}`}>
                      {DEPT_LABELS[a.department]}
                    </span>
                  </div>
                </div>
                <button onClick={() => revokeAccess(a.id)}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bewerbungen Tab */}
      {activeTab === 'applications' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a1d27] border border-yellow-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{visibleApps.filter(a => a.status === 'pending').length}</p>
              <p className="text-gray-400 text-xs mt-1">Ausstehend</p>
            </div>
            <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{visibleApps.filter(a => a.status === 'approved').length}</p>
              <p className="text-gray-400 text-xs mt-1">Angenommen</p>
            </div>
            <div className="bg-[#1a1d27] border border-red-500/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{visibleApps.filter(a => a.status === 'rejected').length}</p>
              <p className="text-gray-400 text-xs mt-1">Abgelehnt</p>
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', ...Object.keys(DEPT_LABELS).filter(d => canSeeDept(d))].map(d => (
              <button key={d} onClick={() => setFilterDept(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterDept === d ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {d === 'all' ? 'Alle Abteilungen' : DEPT_LABELS[d]}
              </button>
            ))}
            {['all', 'pending', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {s === 'all' ? 'Alle Status' : STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
              </button>
            ))}
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

                <div className="p-6 space-y-3">
                  <p className="text-gray-500 text-xs">
                    Eingegangen am {new Date(selectedApp.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>

                  {renderAnswers(selectedApp)}

                  {selectedApp.review_note && (
                    <div className="bg-[#0f1117] rounded-lg p-3 mt-2">
                      <p className="text-gray-400 text-xs mb-1">Anmerkung der Leitung</p>
                      <p className="text-gray-300 text-sm">{selectedApp.review_note}</p>
                    </div>
                  )}

                  {selectedApp.status === 'pending' && (
                    <div className="space-y-3 pt-3 border-t border-white/10">
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
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`text-xs px-2 py-0.5 rounded border ${DEPT_COLORS[app.department]}`}>
                      {DEPT_LABELS[app.department]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[app.status]}`}>
                      {STATUS_LABELS[app.status]}
                    </span>
                    <span className="text-gray-500 text-xs">{new Date(app.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}