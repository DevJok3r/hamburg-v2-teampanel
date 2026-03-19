'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole, Profile } from '@/types';
import { useRouter } from 'next/navigation';

/* ── Types ── */
interface DeptApplication {
  id: string; department: string; ingame_name: string; discord_tag: string;
  age: number; timezone: string; availability: string; experience: string;
  motivation: string; extra_q1: string | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string;
}
interface Phase { department: string; is_open: boolean; updated_at: string; }
interface Question { id: string; type: 'text'|'textarea'|'select'|'radio'|'checkbox'|'scale'|'yesno'; label: string; required: boolean; options?: string[]; }
interface CustomForm { id: string; title: string; department: string; description: string|null; questions: Question[]; is_active: boolean; allowed_roles: string[]; created_by: string; created_at: string; }
interface CustomFormResponse { id: string; form_id: string; answers: Record<string,any>; status: 'pending'|'approved'|'rejected'; review_note: string|null; reviewed_at: string|null; created_at: string; }

/* ── Constants ── */
const DEPT_LABELS: Record<string,string> = { moderation:'Moderation Team', social_media:'Social Media Team', event:'Event Team', development:'Development Team' };
const DEPT_COLORS: Record<string,string> = { moderation:'text-blue-400 bg-blue-500/10 border-blue-500/30', social_media:'text-purple-400 bg-purple-500/10 border-purple-500/30', event:'text-pink-400 bg-pink-500/10 border-pink-500/30', development:'text-green-400 bg-green-500/10 border-green-500/30' };
const DEPT_ICONS: Record<string,string> = { moderation:'🛡️', social_media:'📱', event:'🎉', development:'💻' };
const STATUS_STYLES = { pending:'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', approved:'text-green-400 bg-green-500/10 border-green-500/30', rejected:'text-red-400 bg-red-500/10 border-red-500/30' };
const STATUS_LABELS = { pending:'Ausstehend', approved:'Angenommen', rejected:'Abgelehnt' };
const QUESTION_TYPES = [
  {key:'text',label:'Kurztext',icon:'✏️'},{key:'textarea',label:'Langtext',icon:'📝'},
  {key:'select',label:'Dropdown',icon:'▼'},{key:'radio',label:'Einzelauswahl',icon:'◉'},
  {key:'checkbox',label:'Mehrfachauswahl',icon:'☑️'},{key:'scale',label:'Skala 1-10',icon:'📊'},{key:'yesno',label:'Ja / Nein',icon:'✅'},
];
const ALL_ROLES = ['junior_management','management','top_management','senior_moderator','senior_developer','senior_content','senior_event','moderator','developer','content_producer','event_organizer'];
const ROLE_LABELS: Record<string,string> = {
  top_management:'Top Management', management:'Management', junior_management:'Junior Management',
  senior_moderator:'Senior Moderator', senior_developer:'Senior Developer', senior_content:'Senior Content', senior_event:'Senior Event',
  moderator:'Moderator', developer:'Developer', content_producer:'Content Producer', event_organizer:'Event Organizer',
};
const FIELD_LABELS: Record<string,Record<string,string>> = {
  moderation: { first_name:'Vorname', discord_name:'Discord Name', roblox_name:'Roblox Name', age:'Alter', strengths_weaknesses:'Stärken & Schwächen', motivation:'Warum Moderation Team?', why_you:'Warum genau du?', has_experience:'Erfahrung als Moderator?', three_words:'3 Wörter über dich', hours_per_day:'Stunden pro Tag', active_times:'Aktive Zeiten', situation_1:'Situation 1', situation_2:'Situation 2', situation_3:'Situation 3', situation_4:'Situation 4', situation_5:'Situation 5', rules_accepted:'Regelwerk akzeptiert?', extra_info:'Weitere Mitteilungen' },
  social_media: { roblox_name:'Roblox Name', discord_name:'Discord Name', age:'Alter', scale_grammar:'Skala: Rechtschreibung', scale_time:'Skala: Zeit für Content', motivation:'Warum Social Media?', has_experience:'Erfahrung?', tools:'Tools & Programme', strengths:'Stärken', hours_per_week:'Stunden/Woche', active_times:'Aktive Zeiten', portfolio:'Portfolio Link', rules_accepted:'Regelwerk akzeptiert?', extra_info:'Weitere Mitteilungen' },
  event: { first_name:'Name', roblox_name:'Roblox Name', discord_name:'Discord Name', training_team:'Gewähltes Team', team_knowledge:'Wissen über Team', team_experience:'Eigene Erfahrung', discord_id:'Discord ID', training_concept:'Trainingskonzept', good_trainer:'Guter Event Organizer?', age:'Alter', motivation:'Warum geeignet?', has_microphone:'Mikrofon?', hours_per_week:'Stunden/Woche', active_times:'Aktive Zeiten', rules_accepted:'Regelwerk akzeptiert?', extra_info:'Weitere Mitteilungen' },
  development: { first_name:'Vorname & Alter', roblox_name:'Roblox Name', discord_name:'Discord Name & ID', why_you:'Warum Developer?', dev_experience:'Dev-Erfahrung', dev_area:'Bewerbungsbereich', roblox_studio:'Roblox Studio?', years_active:'Jahre aktiv', portfolio:'Projekte Link', handle_criticism:'Umgang mit Kritik', alone_or_team:'Alleine/Team?', disagreement:'Bei Meinungsverschiedenheit', extra_info:'Weitere Mitteilungen', time_motivation:'Zeit & Motivation?' },
};
type TabType = 'applications'|'links'|'forms'|'responses';
const ROLE_LEVEL: Record<string,number> = { top_management:100, management:80, junior_management:60, senior_moderator:40, senior_developer:40, senior_content:40, senior_event:40, moderator:20, developer:20, content_producer:20, event_organizer:20, trial_moderator:10, trial_developer:10, trial_content:10, trial_event:10 };

export default function DeptApplicationsPage() {
  const [applications, setApplications] = useState<DeptApplication[]>([]);
  const [myRole, setMyRole]             = useState<UserRole|null>(null);
  const [myId, setMyId]                 = useState('');
  const [myAccess, setMyAccess]         = useState<string[]>([]);
  const [allMembers, setAllMembers]     = useState<Profile[]>([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<TabType>('applications');
  const [msg, setMsg]                   = useState<{text:string;ok:boolean}|null>(null);

  // Applications
  const [selectedApp, setSelectedApp]   = useState<DeptApplication|null>(null);
  const [reviewNote, setReviewNote]     = useState('');
  const [filterDept, setFilterDept]     = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Phases
  const [phases, setPhases]             = useState<Phase[]>([]);
  const [savingPhase, setSavingPhase]   = useState<string|null>(null);

  // Custom Forms
  const [forms, setForms]                     = useState<CustomForm[]>([]);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingForm, setEditingForm]         = useState<CustomForm|null>(null);
  const [fbTitle, setFbTitle]                 = useState('');
  const [fbDept, setFbDept]                   = useState('');
  const [fbDesc, setFbDesc]                   = useState('');
  const [fbQuestions, setFbQuestions]         = useState<Question[]>([]);
  const [fbAllowedRoles, setFbAllowedRoles]   = useState<string[]>(['junior_management','management','top_management']);
  const [savingForm, setSavingForm]           = useState(false);

  // Access modal for custom forms
  const [accessModalForm, setAccessModalForm] = useState<CustomForm|null>(null);
  const [accessRoles, setAccessRoles]         = useState<string[]>([]);

  // Responses
  const [responses, setResponses]                   = useState<CustomFormResponse[]>([]);
  const [selectedResponse, setSelectedResponse]     = useState<CustomFormResponse|null>(null);
  const [responseReviewNote, setResponseReviewNote] = useState('');
  const [filterFormId, setFilterFormId]             = useState('all');

  const router   = useRouter();
  const supabase = createClientSupabaseClient();
  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

  function showMsg(text: string, ok = true) { setMsg({text,ok}); setTimeout(() => setMsg(null), 4000); }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: profile } = await supabase.from('profiles').select('role, departments').eq('id', user.id).single();
    if (!profile) { router.push('/dashboard'); return; }
    const role = profile.role as UserRole;
    if (!['top_management','management','junior_management'].includes(role)) { router.push('/dashboard'); return; }
    setMyRole(role);
    const deptMap: Record<string,string> = { moderation_team:'moderation', development_team:'development', content_team:'social_media', event_team:'event' };
    const depts: string[] = profile.departments || [];
    const access = role === 'top_management' ? Object.keys(DEPT_LABELS) : depts.map(d => deptMap[d]).filter(Boolean);
    setMyAccess(access);

    const [appsRes, phasesRes, formsRes, responsesRes, membersRes] = await Promise.all([
      supabase.from('department_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('application_phases').select('*'),
      supabase.from('custom_forms').select('*').order('created_at', { ascending: false }),
      supabase.from('custom_form_responses').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('username'),
    ]);
    setApplications(appsRes.data || []);
    setPhases(phasesRes.data || []);
    setForms(formsRes.data || []);
    setResponses(responsesRes.data || []);
    setAllMembers(membersRes.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  /* ── Permissions ── */
  function canSeeDept(dept: string) {
    if (myRole === 'top_management') return true;
    if (Object.keys(DEPT_LABELS).includes(dept)) return myAccess.includes(dept);
    return false;
  }

  function canSeeCustomForm(form: CustomForm): boolean {
    if (myRole === 'top_management') return true;
    if (!myRole) return false;
    return (form.allowed_roles || []).includes(myRole);
  }

  /* ── Phases ── */
  function getPhase(dept: string): boolean { return phases.find(p => p.department === dept)?.is_open ?? true; }

  async function togglePhase(dept: string) {
    if (!canSeeDept(dept)) return;
    setSavingPhase(dept);
    const current = getPhase(dept);
    await supabase.from('application_phases').upsert({ department: dept, is_open: !current, updated_by: myId, updated_at: new Date().toISOString() }, { onConflict: 'department' });
    setPhases(p => p.map(ph => ph.department === dept ? { ...ph, is_open: !current } : ph));
    setSavingPhase(null);
    showMsg(`Bewerbungsphase ${!current ? 'geöffnet' : 'geschlossen'}.`);
  }

  /* ── Applications ── */
  const visibleApps = applications.filter(a => canSeeDept(a.department));
  const filtered    = visibleApps.filter(a => (filterDept === 'all' || a.department === filterDept) && (filterStatus === 'all' || a.status === filterStatus));

  async function reviewApplication(id: string, status: 'approved'|'rejected') {
    await supabase.from('department_applications').update({ status, review_note: reviewNote||null, reviewed_by: myId, reviewed_at: new Date().toISOString() }).eq('id', id);
    setSelectedApp(null); setReviewNote(''); load();
  }
  async function deleteApplication(id: string) {
    if (!confirm('Bewerbung wirklich löschen?')) return;
    await supabase.from('department_applications').delete().eq('id', id);
    setSelectedApp(null); load();
  }

  function renderAnswers(app: DeptApplication) {
    const labels = FIELD_LABELS[app.department] || {};
    let answers: Record<string,any> = {};
    if (app.extra_q1) { try { answers = JSON.parse(app.extra_q1); } catch { return null; } }
    else { answers = { ingame_name: app.ingame_name, discord_tag: app.discord_tag, age: app.age, motivation: app.motivation }; }
    return Object.entries(answers).map(([key, val]) => {
      if (!val || String(val).trim() === '') return null;
      const label = labels[key] || key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
      return (
        <div key={key} className="bg-[#0f1117] rounded-lg p-4">
          <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
          <p className="text-gray-300 text-sm whitespace-pre-wrap">{String(val)}</p>
        </div>
      );
    });
  }

  /* ── Form Builder ── */
  function openFormBuilder(form?: CustomForm) {
    if (form) {
      setEditingForm(form); setFbTitle(form.title); setFbDept(form.department);
      setFbDesc(form.description||''); setFbQuestions(form.questions);
      setFbAllowedRoles(form.allowed_roles || ['junior_management','management','top_management']);
    } else {
      setEditingForm(null); setFbTitle(''); setFbDept(''); setFbDesc(''); setFbQuestions([]);
      setFbAllowedRoles(['junior_management','management','top_management']);
    }
    setShowFormBuilder(true);
  }

  function addQuestion() { setFbQuestions(p => [...p, { id: crypto.randomUUID(), type: 'text', label: '', required: false }]); }
  function updateQuestion(id: string, patch: Partial<Question>) { setFbQuestions(p => p.map(q => q.id === id ? { ...q, ...patch } : q)); }
  function removeQuestion(id: string) { setFbQuestions(p => p.filter(q => q.id !== id)); }
  function moveQuestion(id: string, dir: 'up'|'down') {
    setFbQuestions(p => {
      const idx = p.findIndex(q => q.id === id);
      if (dir === 'up' && idx === 0) return p;
      if (dir === 'down' && idx === p.length-1) return p;
      const next = [...p]; const swap = dir === 'up' ? idx-1 : idx+1;
      [next[idx], next[swap]] = [next[swap], next[idx]]; return next;
    });
  }

  async function saveForm() {
    if (!fbTitle.trim() || fbQuestions.length === 0) return;
    setSavingForm(true);
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || myId;
    const payload = { title: fbTitle, department: fbDept || 'Allgemein', description: fbDesc||null, questions: fbQuestions, allowed_roles: fbAllowedRoles, created_by: userId };
    let error;
    if (editingForm) {
      const res = await supabase.from('custom_forms').update(payload).eq('id', editingForm.id);
      error = res.error;
    } else {
      const res = await supabase.from('custom_forms').insert({ ...payload, is_active: true });
      error = res.error;
    }
    setSavingForm(false);
    if (error) { showMsg('Fehler: ' + error.message, false); return; }
    setShowFormBuilder(false);
    showMsg('✅ Formular gespeichert.');
    await load();
  }

  async function deleteForm(id: string) {
    if (!confirm('Formular wirklich löschen? Alle Antworten werden ebenfalls gelöscht.')) return;
    await supabase.from('custom_forms').delete().eq('id', id);
    showMsg('✅ Formular gelöscht.'); load();
  }

  async function toggleFormActive(form: CustomForm) {
    await supabase.from('custom_forms').update({ is_active: !form.is_active }).eq('id', form.id);
    setForms(p => p.map(f => f.id === form.id ? { ...f, is_active: !f.is_active } : f));
    showMsg(`Formular ${!form.is_active ? 'aktiviert' : 'deaktiviert'}.`);
  }

  async function saveAccessRoles() {
    if (!accessModalForm) return;
    await supabase.from('custom_forms').update({ allowed_roles: accessRoles }).eq('id', accessModalForm.id);
    setForms(p => p.map(f => f.id === accessModalForm.id ? { ...f, allowed_roles: accessRoles } : f));
    setAccessModalForm(null);
    showMsg('✅ Zugriffsrechte gespeichert.');
  }

  /* ── Responses ── */
  const visibleForms     = forms.filter(f => canSeeCustomForm(f));
  const visibleResponses = responses.filter(r => visibleForms.some(f => f.id === r.form_id));
  const filteredResponses = visibleResponses.filter(r => filterFormId === 'all' || r.form_id === filterFormId);

  async function reviewResponse(id: string, status: 'approved'|'rejected') {
    await supabase.from('custom_form_responses').update({ status, review_note: responseReviewNote||null, reviewed_by: myId, reviewed_at: new Date().toISOString() }).eq('id', id);
    setSelectedResponse(null); setResponseReviewNote(''); load();
  }

  const pendingCount  = visibleApps.filter(a => a.status === 'pending').length;
  const responseCount = visibleResponses.filter(r => r.status === 'pending').length;

  // All custom forms visible to top management for links tab
  const allVisibleForms = myRole === 'top_management' ? forms : visibleForms;

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Bewerbungen</h1>
        <p className="text-gray-400 text-sm mt-1">{visibleApps.length} Bewerbungen · {allVisibleForms.length} eigene Formulare</p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>{msg.text}</div>
      )}

      {/* TABS */}
      <div className="flex gap-1 bg-[#1a1d27] border border-white/10 rounded-xl p-1 overflow-x-auto">
        {([
          {key:'applications',label:'Bewerbungen',icon:'📋',count:pendingCount},
          {key:'links',label:'Links & Phasen',icon:'🔗',count:0},
          {key:'forms',label:'Eigene Formulare',icon:'📝',count:allVisibleForms.length},
          {key:'responses',label:'Formular-Antworten',icon:'📨',count:responseCount},
        ] as {key:TabType;label:string;icon:string;count:number}[]).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.icon} {t.label}
            {t.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.key ? 'bg-white/20' : 'bg-white/10 text-gray-500'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ══ TAB: LINKS & PHASEN ══ */}
      {activeTab === 'links' && (
        <div className="space-y-4">
          {/* Feste Abteilungen */}
          {Object.keys(DEPT_LABELS).filter(d => canSeeDept(d)).map(dept => {
            const isOpen    = getPhase(dept);
            const saving    = savingPhase === dept;
            const deptForms = allVisibleForms.filter(f => f.department === dept);
            return (
              <div key={dept} className={`bg-[#1a1d27] border rounded-xl overflow-hidden ${isOpen ? 'border-white/10' : 'border-red-500/20'}`}>
                <div className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{DEPT_ICONS[dept]}</span>
                    <div>
                      <p className="text-white font-semibold">{DEPT_LABELS[dept]}</p>
                      <span className={`text-xs px-2 py-0.5 rounded border ${isOpen ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
                        {isOpen ? '🟢 Bewerbungsphase offen' : '🔴 Bewerbungsphase geschlossen'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => togglePhase(dept)} disabled={saving}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition disabled:opacity-40 ${isOpen ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30'}`}>
                    {saving ? '...' : isOpen ? '🔒 Schließen' : '🔓 Öffnen'}
                  </button>
                </div>
                <div className="border-t border-white/10 p-5 space-y-2">
                  <p className="text-gray-500 text-xs font-medium mb-3">BEWERBUNGSLINKS</p>
                  <div className="bg-[#0f1117] rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-500 flex-shrink-0">Standard</span>
                      <span className="text-gray-400 text-xs font-mono truncate">{BASE_URL}/apply/{dept}</span>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(`${BASE_URL}/apply/${dept}`); showMsg('Link kopiert!'); }}
                      className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition flex-shrink-0">
                      📋 Kopieren
                    </button>
                  </div>
                  {deptForms.map(f => (
                    <div key={f.id} className="bg-[#0f1117] rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-purple-400 text-xs font-medium flex-shrink-0">📝 {f.title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${f.is_active ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>
                            {f.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => toggleFormActive(f)} className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${f.is_active ? 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30'}`}>
                            {f.is_active ? '🔒' : '🔓'}
                          </button>
                          <button onClick={() => openFormBuilder(f)} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-2.5 py-1 rounded-lg transition">✏️</button>
                          {myRole === 'top_management' && (
                            <button onClick={() => { setAccessModalForm(f); setAccessRoles(f.allowed_roles || []); }} className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs px-2.5 py-1 rounded-lg transition">🔑</button>
                          )}
                          <button onClick={() => deleteForm(f.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2.5 py-1 rounded-lg transition">🗑️</button>
                          <button onClick={() => { navigator.clipboard.writeText(`${BASE_URL}/apply/form/${f.id}`); showMsg('Link kopiert!'); }} className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs px-2.5 py-1 rounded-lg transition">📋</button>
                        </div>
                      </div>
                      <span className="text-gray-600 text-xs font-mono">{BASE_URL}/apply/form/{f.id}</span>
                      <p className="text-gray-600 text-xs mt-1">❓ {f.questions.length} Fragen · 📨 {responses.filter(r => r.form_id === f.id).length} Antworten{responses.filter(r => r.form_id === f.id && r.status === 'pending').length > 0 && <span className="text-yellow-400"> · ⏳ {responses.filter(r => r.form_id === f.id && r.status === 'pending').length} ausstehend</span>}</p>
                    </div>
                  ))}
                  {deptForms.length === 0 && <p className="text-gray-600 text-xs italic px-1">Keine eigenen Formulare für diese Abteilung</p>}
                </div>
              </div>
            );
          })}

          {/* Eigene Kategorien */}
          {(() => {
            const customCatForms = allVisibleForms.filter(f => !Object.keys(DEPT_LABELS).includes(f.department));
            if (customCatForms.length === 0) return null;
            const byCategory: Record<string,CustomForm[]> = {};
            customCatForms.forEach(f => { if (!byCategory[f.department]) byCategory[f.department] = []; byCategory[f.department].push(f); });
            return Object.entries(byCategory).map(([category, catForms]) => (
              <div key={category} className="bg-[#1a1d27] border border-white/10 rounded-xl overflow-hidden">
                <div className="p-5 flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <p className="text-white font-semibold">{category}</p>
                    <span className="text-xs px-2 py-0.5 rounded border text-purple-400 bg-purple-500/10 border-purple-500/30">Eigene Kategorie</span>
                  </div>
                </div>
                <div className="border-t border-white/10 p-5 space-y-2">
                  <p className="text-gray-500 text-xs font-medium mb-3">BEWERBUNGSLINKS</p>
                  {catForms.map(f => (
                    <div key={f.id} className="bg-[#0f1117] rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-purple-400 text-xs font-medium flex-shrink-0">📝 {f.title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${f.is_active ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>{f.is_active ? 'Aktiv' : 'Inaktiv'}</span>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => toggleFormActive(f)} className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${f.is_active ? 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30'}`}>{f.is_active ? '🔒' : '🔓'}</button>
                          <button onClick={() => openFormBuilder(f)} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-2.5 py-1 rounded-lg transition">✏️</button>
                          {myRole === 'top_management' && (
                            <button onClick={() => { setAccessModalForm(f); setAccessRoles(f.allowed_roles || []); }} className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs px-2.5 py-1 rounded-lg transition">🔑</button>
                          )}
                          <button onClick={() => deleteForm(f.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2.5 py-1 rounded-lg transition">🗑️</button>
                          <button onClick={() => { navigator.clipboard.writeText(`${BASE_URL}/apply/form/${f.id}`); showMsg('Link kopiert!'); }} className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs px-2.5 py-1 rounded-lg transition">📋</button>
                        </div>
                      </div>
                      <span className="text-gray-600 text-xs font-mono">{BASE_URL}/apply/form/{f.id}</span>
                      <p className="text-gray-600 text-xs mt-1">❓ {f.questions.length} Fragen · 📨 {responses.filter(r => r.form_id === f.id).length} Antworten{responses.filter(r => r.form_id === f.id && r.status === 'pending').length > 0 && <span className="text-yellow-400"> · ⏳ {responses.filter(r => r.form_id === f.id && r.status === 'pending').length} ausstehend</span>}</p>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}

          <button onClick={() => { setActiveTab('forms'); openFormBuilder(); }}
            className="w-full bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-white/30 text-gray-400 hover:text-white py-4 rounded-xl text-sm transition flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Neues eigenes Formular erstellen
          </button>
        </div>
      )}

      {/* ══ TAB: EIGENE FORMULARE ══ */}
      {activeTab === 'forms' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => openFormBuilder()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Neues Formular
            </button>
          </div>
          {allVisibleForms.length === 0 && (
            <div className="text-center py-16 bg-[#1a1d27] border border-white/10 rounded-xl">
              <p className="text-4xl mb-3">📝</p>
              <p className="text-white font-medium mb-1">Noch keine eigenen Formulare</p>
              <p className="text-gray-400 text-sm">Erstelle eigene Bewerbungsformulare für beliebige Kategorien</p>
            </div>
          )}
          <div className="space-y-3">
            {allVisibleForms.map(form => {
              const respCount = responses.filter(r => r.form_id === form.id).length;
              const pendCount = responses.filter(r => r.form_id === form.id && r.status === 'pending').length;
              return (
                <div key={form.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-white font-semibold">{form.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded border ${DEPT_COLORS[form.department] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>{DEPT_LABELS[form.department] || form.department}</span>
                        <span className={`text-xs px-2 py-0.5 rounded border ${form.is_active ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>{form.is_active ? '🟢 Aktiv' : '⚫ Inaktiv'}</span>
                      </div>
                      {form.description && <p className="text-gray-400 text-xs line-clamp-1">{form.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>❓ {form.questions.length} Fragen</span>
                        <span>📨 {respCount} Antworten</span>
                        {pendCount > 0 && <span className="text-yellow-400 font-medium">⏳ {pendCount} ausstehend</span>}
                        <span>🔑 {(form.allowed_roles||[]).length} Rollen</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => toggleFormActive(form)} className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${form.is_active ? 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30'}`}>{form.is_active ? 'Deaktivieren' : 'Aktivieren'}</button>
                      <button onClick={() => openFormBuilder(form)} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-3 py-1.5 rounded-lg font-medium transition">✏️ Bearbeiten</button>
                      {myRole === 'top_management' && (
                        <button onClick={() => { setAccessModalForm(form); setAccessRoles(form.allowed_roles || []); }} className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs px-3 py-1.5 rounded-lg font-medium transition">🔑 Zugriff</button>
                      )}
                      <button onClick={() => deleteForm(form.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1.5 rounded-lg font-medium transition">🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TAB: FORMULAR-ANTWORTEN ══ */}
      {activeTab === 'responses' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterFormId('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterFormId === 'all' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>Alle Formulare</button>
            {allVisibleForms.map(f => (
              <button key={f.id} onClick={() => setFilterFormId(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterFormId === f.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{f.title}</button>
            ))}
          </div>
          {filteredResponses.length === 0 && (
            <div className="text-center py-12 bg-[#1a1d27] border border-white/10 rounded-xl">
              <p className="text-3xl mb-2">📭</p><p className="text-gray-400 text-sm">Keine Antworten vorhanden</p>
            </div>
          )}
          <div className="space-y-3">
            {filteredResponses.map(resp => {
              const form       = forms.find(f => f.id === resp.form_id);
              const firstAnswer = form?.questions[0] ? resp.answers[form.questions[0].id] : null;
              return (
                <div key={resp.id} onClick={() => setSelectedResponse(resp)}
                  className="bg-[#1a1d27] border border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {String(firstAnswer||'?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{String(firstAnswer||'Anonym')}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {form && <span className={`text-xs px-1.5 py-0.5 rounded border ${DEPT_COLORS[form.department] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>{form.title}</span>}
                          <span className="text-gray-500 text-xs">{new Date(resp.created_at).toLocaleDateString('de-DE')}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded border font-medium flex-shrink-0 ${STATUS_STYLES[resp.status as keyof typeof STATUS_STYLES]}`}>{STATUS_LABELS[resp.status as keyof typeof STATUS_LABELS]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TAB: BEWERBUNGEN ══ */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a1d27] border border-yellow-500/20 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-yellow-400">{visibleApps.filter(a=>a.status==='pending').length}</p><p className="text-gray-400 text-xs mt-1">Ausstehend</p></div>
            <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-green-400">{visibleApps.filter(a=>a.status==='approved').length}</p><p className="text-gray-400 text-xs mt-1">Angenommen</p></div>
            <div className="bg-[#1a1d27] border border-red-500/20 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-red-400">{visibleApps.filter(a=>a.status==='rejected').length}</p><p className="text-gray-400 text-xs mt-1">Abgelehnt</p></div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all',...Object.keys(DEPT_LABELS).filter(d => canSeeDept(d))].map(d => (
              <button key={d} onClick={() => setFilterDept(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterDept===d?'bg-blue-600 text-white':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{d==='all'?'Alle Abteilungen':DEPT_LABELS[d]}</button>
            ))}
            {['all','pending','approved','rejected'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus===s?'bg-blue-600 text-white':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>{s==='all'?'Alle Status':STATUS_LABELS[s as keyof typeof STATUS_LABELS]}</button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 bg-[#1a1d27] border border-white/10 rounded-xl"><p className="text-3xl mb-2">📭</p><p className="text-gray-400 text-sm">Keine Bewerbungen vorhanden</p></div>
          ) : (
            <div className="space-y-3">
              {filtered.map(app => (
                <div key={app.id} onClick={() => setSelectedApp(app)}
                  className="bg-[#1a1d27] border border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">{app.ingame_name.charAt(0).toUpperCase()}</div>
                      <div><p className="text-white font-semibold">{app.ingame_name}</p><p className="text-gray-500 text-xs">{app.discord_tag}</p></div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className={`text-xs px-2 py-0.5 rounded border ${DEPT_COLORS[app.department] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>{DEPT_ICONS[app.department] || '📋'} {DEPT_LABELS[app.department] || app.department}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[app.status]}`}>{STATUS_LABELS[app.status]}</span>
                      <span className="text-gray-500 text-xs">{new Date(app.created_at).toLocaleDateString('de-DE')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ MODAL: BEWERBUNG DETAIL ══ */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">{selectedApp.ingame_name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded border ${DEPT_COLORS[selectedApp.department] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>{DEPT_ICONS[selectedApp.department] || '📋'} {DEPT_LABELS[selectedApp.department] || selectedApp.department}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[selectedApp.status]}`}>{STATUS_LABELS[selectedApp.status]}</span>
                </div>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-gray-500 text-xs">Eingegangen am {new Date(selectedApp.created_at).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
              {renderAnswers(selectedApp)}
              {selectedApp.review_note && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-blue-400 text-xs font-medium mb-1">Anmerkung der Leitung</p>
                  <p className="text-gray-300 text-sm">{selectedApp.review_note}</p>
                </div>
              )}
              {selectedApp.status === 'pending' && (
                <div className="space-y-3 pt-3 border-t border-white/10">
                  <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Anmerkung (optional)..." rows={2}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => deleteApplication(selectedApp.id)} className="bg-white/5 hover:bg-white/10 text-gray-400 text-sm px-4 py-2 rounded-lg transition">🗑️ Löschen</button>
                    <button onClick={() => reviewApplication(selectedApp.id, 'rejected')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium text-sm px-4 py-2 rounded-lg transition">❌ Ablehnen</button>
                    <button onClick={() => reviewApplication(selectedApp.id, 'approved')} className="bg-green-600 hover:bg-green-700 text-white font-medium text-sm px-5 py-2 rounded-lg transition">✅ Annehmen</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: FORMULAR-ANTWORT DETAIL ══ */}
      {selectedResponse && (() => {
        const form = forms.find(f => f.id === selectedResponse.form_id);
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg">{form?.title || 'Formular-Antwort'}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {form && <span className={`text-xs px-2 py-0.5 rounded border ${DEPT_COLORS[form.department] || 'text-gray-400 bg-gray-500/10 border-gray-500/30'}`}>{form.department}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[selectedResponse.status as keyof typeof STATUS_STYLES]}`}>{STATUS_LABELS[selectedResponse.status as keyof typeof STATUS_LABELS]}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedResponse(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-gray-500 text-xs">Eingegangen am {new Date(selectedResponse.created_at).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                {form?.questions.map(q => {
                  const val = selectedResponse.answers[q.id];
                  if (!val && val !== 0) return null;
                  return (
                    <div key={q.id} className="bg-[#0f1117] rounded-lg p-4">
                      <p className="text-gray-400 text-xs font-medium mb-1">{q.label}</p>
                      <p className="text-gray-300 text-sm whitespace-pre-wrap">{Array.isArray(val) ? val.join(', ') : String(val)}</p>
                    </div>
                  );
                })}
                {selectedResponse.status === 'pending' && (
                  <div className="space-y-3 pt-3 border-t border-white/10">
                    <textarea value={responseReviewNote} onChange={e => setResponseReviewNote(e.target.value)} placeholder="Anmerkung (optional)..." rows={2}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => reviewResponse(selectedResponse.id, 'rejected')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium text-sm px-4 py-2 rounded-lg transition">❌ Ablehnen</button>
                      <button onClick={() => reviewResponse(selectedResponse.id, 'approved')} className="bg-green-600 hover:bg-green-700 text-white font-medium text-sm px-5 py-2 rounded-lg transition">✅ Annehmen</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL: ZUGRIFFSRECHTE (nur Top Management) ══ */}
      {accessModalForm && myRole === 'top_management' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">🔑 Zugriffsrechte</h2>
                <p className="text-gray-400 text-xs mt-1">{accessModalForm.title}</p>
              </div>
              <button onClick={() => setAccessModalForm(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-400 text-xs">Wähle welche Rollen dieses Formular sehen und bearbeiten können. Top Management hat immer Zugriff.</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {ALL_ROLES.filter(r => r !== 'top_management').map(role => (
                  <label key={role} className="flex items-center gap-3 bg-[#0f1117] rounded-lg px-4 py-2.5 cursor-pointer hover:bg-white/5 transition">
                    <input type="checkbox"
                      checked={accessRoles.includes(role)}
                      onChange={() => setAccessRoles(p => p.includes(role) ? p.filter(r => r !== role) : [...p, role])}
                      className="accent-blue-500" />
                    <span className="text-white text-sm">{ROLE_LABELS[role] || role}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setAccessModalForm(null)} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg text-sm transition">Abbrechen</button>
                <button onClick={saveAccessRoles} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition">💾 Speichern</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: FORM BUILDER ══ */}
      {showFormBuilder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">{editingForm ? 'Formular bearbeiten' : 'Neues Formular erstellen'}</h2>
              <button onClick={() => setShowFormBuilder(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs mb-1 block">Formular-Titel</label>
                  <input value={fbTitle} onChange={e => setFbTitle(e.target.value)} placeholder="z.B. Game Tester Bewerbung, PR Team Application..."
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Kategorie / Abteilung</label>
                  <input value={fbDept} onChange={e => setFbDept(e.target.value)} placeholder="z.B. Game Tester, PR Team, Support..."
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
                  <p className="text-gray-600 text-xs mt-1">Frei wählbar – auch eigene Kategorien möglich</p>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Beschreibung (optional)</label>
                  <input value={fbDesc} onChange={e => setFbDesc(e.target.value)} placeholder="Kurze Beschreibung..."
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Zugriffsrechte im Form Builder */}
              {myRole === 'top_management' && (
                <div>
                  <label className="text-gray-400 text-xs mb-2 block">🔑 Zugriffsrechte – Wer kann dieses Formular sehen?</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_ROLES.filter(r => r !== 'top_management').map(role => (
                      <label key={role} className="flex items-center gap-2 bg-[#0f1117] rounded-lg px-3 py-2 cursor-pointer hover:bg-white/5 transition">
                        <input type="checkbox" checked={fbAllowedRoles.includes(role)}
                          onChange={() => setFbAllowedRoles(p => p.includes(role) ? p.filter(r => r !== role) : [...p, role])}
                          className="accent-blue-500" />
                        <span className="text-white text-xs">{ROLE_LABELS[role] || role}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-gray-600 text-xs mt-1">Top Management hat immer Zugriff.</p>
                </div>
              )}

              {/* Fragen */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-white font-medium text-sm">Fragen ({fbQuestions.length})</p>
                  <button onClick={addQuestion} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-3 py-1.5 rounded-lg transition">+ Frage hinzufügen</button>
                </div>
                {fbQuestions.length === 0 && (
                  <div className="text-center py-8 bg-[#0f1117] rounded-xl border border-dashed border-white/10">
                    <p className="text-gray-500 text-sm">Noch keine Fragen. Klicke auf "+ Frage hinzufügen".</p>
                  </div>
                )}
                <div className="space-y-3">
                  {fbQuestions.map((q, idx) => (
                    <div key={q.id} className="bg-[#0f1117] border border-white/10 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500 text-xs font-medium">Frage {idx+1}</span>
                        <div className="flex gap-1">
                          <button onClick={() => moveQuestion(q.id,'up')} disabled={idx===0} className="text-gray-500 hover:text-white disabled:opacity-20 text-sm px-2 py-1 rounded transition">↑</button>
                          <button onClick={() => moveQuestion(q.id,'down')} disabled={idx===fbQuestions.length-1} className="text-gray-500 hover:text-white disabled:opacity-20 text-sm px-2 py-1 rounded transition">↓</button>
                          <button onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded transition">✕</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <input value={q.label} onChange={e => updateQuestion(q.id,{label:e.target.value})} placeholder="Frage / Beschriftung..."
                            className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <select value={q.type} onChange={e => updateQuestion(q.id,{type:e.target.value as Question['type'],options:undefined})}
                            className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                            {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={q.required} onChange={e => updateQuestion(q.id,{required:e.target.checked})} className="accent-blue-500" />
                            <span className="text-gray-400 text-xs">Pflichtfeld</span>
                          </label>
                        </div>
                      </div>
                      {['select','radio','checkbox'].includes(q.type) && (
                        <div>
                          <label className="text-gray-500 text-xs mb-1 block">Optionen (eine pro Zeile)</label>
                          <textarea value={(q.options||[]).join('\n')} onChange={e => updateQuestion(q.id,{options:e.target.value.split('\n').filter(Boolean)})}
                            placeholder={"Option 1\nOption 2\nOption 3"} rows={3}
                            className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-blue-500 resize-none" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowFormBuilder(false)} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg text-sm transition">Abbrechen</button>
                <button onClick={saveForm} disabled={savingForm || !fbTitle.trim() || fbQuestions.length === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition">
                  {savingForm ? 'Speichern...' : editingForm ? '💾 Änderungen speichern' : '✅ Formular erstellen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
