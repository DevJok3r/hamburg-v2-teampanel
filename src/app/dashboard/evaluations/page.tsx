'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole, Profile } from '@/types';
import RoleBadge from '@/components/RoleBadge';

interface Evaluation {
  id: string;
  user_id: string;
  evaluator_id: string;
  status: 'draft' | 'completed';
  period: string;
  score_activity: number | null;
  score_player_interaction: number | null;
  score_task_completion: number | null;
  score_resilience: number | null;
  score_problem_solving: number | null;
  score_player_communication: number | null;
  score_team_communication: number | null;
  score_initiative: number | null;
  score_reliability: number | null;
  score_rule_knowledge: number | null;
  average_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { username: string; role: UserRole };
  evaluator?: { username: string; role: UserRole };
}

const CATEGORIES: { key: keyof Evaluation; label: string; desc: string }[] = [
  { key: 'score_activity',             label: 'Aktivität',                                    desc: 'Regelmäßige Präsenz & Aktivität im Team' },
  { key: 'score_player_interaction',   label: 'Umgang mit Spielern & Teammitgliedern',        desc: 'Respektvoller & professioneller Umgang' },
  { key: 'score_task_completion',      label: 'Aufgaben-Erledigung',                          desc: 'Zuverlässige & vollständige Erledigung von Aufgaben' },
  { key: 'score_resilience',           label: 'Kritiksicherheit & Verhalten unter Druck',     desc: 'Umgang mit Kritik & Stresssituationen' },
  { key: 'score_problem_solving',      label: 'Problemlösung & Entscheidungsfindung',         desc: 'Eigenständiges Lösen von Problemen' },
  { key: 'score_player_communication', label: 'Kommunikation mit Spielern',                   desc: 'Klare & freundliche Kommunikation mit Spielern' },
  { key: 'score_team_communication',   label: 'Kommunikation mit Teammitgliedern',            desc: 'Interne Kommunikation & Informationsweitergabe' },
  { key: 'score_initiative',           label: 'Eigeninitiative / Engagement',                 desc: 'Eigene Ideen & proaktives Handeln' },
  { key: 'score_reliability',          label: 'Zuverlässigkeit & Pünktlichkeit',              desc: 'Konferenzteilnahme, Deadlines einhalten' },
  { key: 'score_rule_knowledge',       label: 'Regelkenntnis & Regelanwendung',               desc: 'Kennt & wendet Regeln korrekt an' },
];

function getGrade(avg: number | null): { label: string; color: string; uprank: string } {
  if (avg === null) return { label: '–', color: 'text-gray-400', uprank: '' };
  if (avg <= 1.5) return { label: '1 – Sehr gut',     color: 'text-green-400',  uprank: 'Uprank möglich' };
  if (avg <= 2.5) return { label: '2 – Gut',           color: 'text-blue-400',   uprank: 'Uprank möglich' };
  if (avg <= 3.5) return { label: '3 – Befriedigend',  color: 'text-yellow-400', uprank: 'Neutral, Uprank trotzdem möglich' };
  if (avg <= 4.5) return { label: '4 – Ausreichend',   color: 'text-orange-400', uprank: 'Uprank nicht möglich' };
  if (avg <= 5.5) return { label: '5 – Mangelhaft',    color: 'text-red-400',    uprank: 'Gespräch mit Team Lead' };
  return           { label: '6 – Ungenügend',           color: 'text-red-600',    uprank: 'Gespräch mit Team Lead & Top Management' };
}

function ScoreSelector({ value, onChange, disabled }: { value: number | null; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5, 6].map(n => (
        <button key={n} disabled={disabled} onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-lg text-sm font-bold transition border
            ${value === n
              ? n <= 2 ? 'bg-green-500/20 text-green-400 border-green-500/50'
                : n <= 3 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
                : n <= 4 ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                : 'bg-red-500/20 text-red-400 border-red-500/50'
              : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40'}`}>
          {n}
        </button>
      ))}
    </div>
  );
}

export default function EvaluationsPage() {
  const [evaluations, setEvaluations]   = useState<Evaluation[]>([]);
  const [members, setMembers]           = useState<Profile[]>([]);
  const [myRole, setMyRole]             = useState<UserRole | null>(null);
  const [myId, setMyId]                 = useState<string>('');
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<'all' | 'draft' | 'completed'>('all');
  const [editEval, setEditEval]         = useState<Evaluation | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [viewEval, setViewEval]         = useState<Evaluation | null>(null);

  const [form, setForm] = useState({
    user_id: '',
    period: '',
    notes: '',
    score_activity: null as number | null,
    score_player_interaction: null as number | null,
    score_task_completion: null as number | null,
    score_resilience: null as number | null,
    score_problem_solving: null as number | null,
    score_player_communication: null as number | null,
    score_team_communication: null as number | null,
    score_initiative: null as number | null,
    score_reliability: null as number | null,
    score_rule_knowledge: null as number | null,
  });

  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile) setMyRole(profile.role as UserRole);

    const { data: evals } = await supabase
      .from('evaluations')
      .select('*, profiles!evaluations_user_id_fkey(username, role), evaluator:evaluator_id(username, role)')
      .order('created_at', { ascending: false });

    const { data: allMembers } = await supabase
      .from('profiles').select('*').eq('is_active', true).order('username');

    setEvaluations(evals || []);
    setMembers(allMembers || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const canManage = myRole && ['top_management', 'management', 'junior_management'].includes(myRole);

  function resetForm() {
    setForm({
      user_id: '', period: '', notes: '',
      score_activity: null, score_player_interaction: null, score_task_completion: null,
      score_resilience: null, score_problem_solving: null, score_player_communication: null,
      score_team_communication: null, score_initiative: null, score_reliability: null,
      score_rule_knowledge: null,
    });
  }

  async function saveEvaluation(status: 'draft' | 'completed') {
    if (!form.user_id || !form.period.trim()) return;
    const payload = { ...form, status, evaluator_id: myId };

    if (editEval) {
      await supabase.from('evaluations').update(payload).eq('id', editEval.id);
      setEditEval(null);
    } else {
      await supabase.from('evaluations').insert(payload);
    }
    resetForm();
    setShowForm(false);
    load();
  }

  async function deleteEvaluation(id: string) {
    await supabase.from('evaluations').delete().eq('id', id);
    load();
  }

  const filtered = evaluations.filter(e => activeTab === 'all' || e.status === activeTab);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  if (!canManage) return <div className="text-center py-12 text-gray-400">Kein Zugriff.</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Leistungsbewertungen</h1>
          <p className="text-gray-400 text-sm mt-1">{evaluations.length} Bewertungen gesamt</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditEval(null); resetForm(); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg
                     transition text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Bewertung
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{evaluations.length}</p>
          <p className="text-gray-400 text-xs mt-1">Gesamt</p>
        </div>
        <div className="bg-[#1a1d27] border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{evaluations.filter(e => e.status === 'draft').length}</p>
          <p className="text-gray-400 text-xs mt-1">Entwürfe</p>
        </div>
        <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{evaluations.filter(e => e.status === 'completed').length}</p>
          <p className="text-gray-400 text-xs mt-1">Abgeschlossen</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all',       label: `Alle (${evaluations.length})` },
          { key: 'draft',     label: `Entwürfe (${evaluations.filter(e => e.status === 'draft').length})` },
          { key: 'completed', label: `Abgeschlossen (${evaluations.filter(e => e.status === 'completed').length})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition
              ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Formular Modal */}
      {(showForm || editEval) && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-white font-bold text-lg mb-5">
              {editEval ? 'Bewertung bearbeiten' : 'Neue Leistungsbewertung'}
            </h2>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Teammitglied *</label>
                  <select value={form.user_id} onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Mitglied wählen...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.username} ({m.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Bewertungszeitraum *</label>
                  <input value={form.period}
                    onChange={e => setForm(p => ({ ...p, period: e.target.value }))}
                    placeholder="z.B. Januar 2025, Q1 2025..."
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                               text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Kategorien */}
              <div className="space-y-3">
                <p className="text-white font-medium text-sm">Bewertungskategorien</p>
                <p className="text-gray-500 text-xs">Note 1 = Sehr gut, Note 6 = Ungenügend</p>
                {CATEGORIES.map(cat => (
                  <div key={cat.key} className="bg-[#0f1117] rounded-lg p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{cat.label}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{cat.desc}</p>
                      </div>
                      <ScoreSelector
                        value={form[cat.key as keyof typeof form] as number | null}
                        onChange={v => setForm(p => ({ ...p, [cat.key]: v }))}
                        disabled={false}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Durchschnitt Vorschau */}
              {(() => {
                const scores = CATEGORIES.map(c => form[c.key] as number | null).filter(s => s !== null) as number[];
                const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
                const grade = getGrade(avg ? Math.round(avg * 100) / 100 : null);
                return avg !== null ? (
                  <div className="bg-[#0f1117] rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-xs mb-1">Voraussichtliche Gesamtnote</p>
                    <p className={`text-2xl font-bold ${grade.color}`}>{avg.toFixed(2)}</p>
                    <p className={`text-sm font-medium ${grade.color}`}>{grade.label}</p>
                    {grade.uprank && <p className="text-gray-400 text-xs mt-1">{grade.uprank}</p>}
                    <p className="text-gray-500 text-xs mt-1">{scores.length}/10 Kategorien bewertet</p>
                  </div>
                ) : null;
              })()}

              {/* Notizen */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Anmerkungen / Notizen</label>
                <textarea value={form.notes || ''}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Zusätzliche Anmerkungen zur Bewertung..."
                  rows={3}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                             text-white placeholder-gray-500 text-sm focus:outline-none
                             focus:border-blue-500 resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowForm(false); setEditEval(null); resetForm(); }}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm transition">
                  Abbrechen
                </button>
                <button onClick={() => saveEvaluation('draft')}
                  className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30
                             font-medium px-4 py-2 rounded-lg text-sm transition">
                  Als Entwurf speichern
                </button>
                <button onClick={() => saveEvaluation('completed')}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
                  Abschließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {viewEval && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-bold text-lg">
                  Bewertung – {viewEval.profiles?.username}
                </h2>
                <p className="text-gray-400 text-sm">{viewEval.period}</p>
              </div>
              <button onClick={() => setViewEval(null)} className="text-gray-400 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Gesamtnote */}
            {(() => {
              const grade = getGrade(viewEval.average_score);
              return (
                <div className="bg-[#0f1117] rounded-xl p-5 text-center mb-5">
                  <p className="text-gray-400 text-xs mb-1">Gesamtnote</p>
                  <p className={`text-4xl font-bold ${grade.color}`}>
                    {viewEval.average_score?.toFixed(2) || '–'}
                  </p>
                  <p className={`text-lg font-medium mt-1 ${grade.color}`}>{grade.label}</p>
                  {grade.uprank && (
                    <p className="text-gray-400 text-sm mt-1">{grade.uprank}</p>
                  )}
                </div>
              );
            })()}

            {/* Kategorien */}
            <div className="space-y-2 mb-5">
              {CATEGORIES.map(cat => {
                const score = viewEval[cat.key] as number | null;
                const grade = getGrade(score);
                return (
                  <div key={cat.key} className="bg-[#0f1117] rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm">{cat.label}</p>
                      <p className="text-gray-500 text-xs">{cat.desc}</p>
                    </div>
                    <div className="text-right">
                      {score !== null ? (
                        <>
                          <p className={`text-lg font-bold ${grade.color}`}>{score.toFixed(1)}</p>
                        </>
                      ) : (
                        <p className="text-gray-600 text-sm">–</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {viewEval.notes && (
              <div className="bg-[#0f1117] rounded-lg p-4 mb-4">
                <p className="text-gray-400 text-xs font-medium mb-1">Anmerkungen</p>
                <p className="text-gray-300 text-sm">{viewEval.notes}</p>
              </div>
            )}

            <div className="text-gray-500 text-xs">
              Bewertet von {(viewEval.evaluator as any)?.username} · {new Date(viewEval.created_at).toLocaleString('de-DE', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Keine Bewertungen vorhanden</div>
        ) : filtered.map(ev => {
          const grade = getGrade(ev.average_score);
          return (
            <div key={ev.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full
                                  flex items-center justify-center text-white font-bold flex-shrink-0">
                    {ev.profiles?.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">{ev.profiles?.username}</span>
                      {ev.profiles?.role && <RoleBadge role={ev.profiles.role} size="xs" />}
                      <span className={`text-xs px-2 py-0.5 rounded border
                        ${ev.status === 'draft'
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                          : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
                        {ev.status === 'draft' ? 'Entwurf' : 'Abgeschlossen'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs">{ev.period} · von {(ev.evaluator as any)?.username}</p>
                  </div>
                  {ev.average_score !== null && (
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${grade.color}`}>{ev.average_score.toFixed(2)}</p>
                      <p className={`text-xs ${grade.color}`}>{grade.label.split(' – ')[1]}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setViewEval(ev)}
                    className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30
                               text-xs font-medium px-3 py-1.5 rounded-lg transition">
                    Details
                  </button>
                  {ev.status === 'draft' && (
                    <button onClick={() => {
                      setEditEval(ev);
                      setForm({
                        user_id: ev.user_id,
                        period: ev.period,
                        notes: ev.notes || '',
                        score_activity: ev.score_activity,
                        score_player_interaction: ev.score_player_interaction,
                        score_task_completion: ev.score_task_completion,
                        score_resilience: ev.score_resilience,
                        score_problem_solving: ev.score_problem_solving,
                        score_player_communication: ev.score_player_communication,
                        score_team_communication: ev.score_team_communication,
                        score_initiative: ev.score_initiative,
                        score_reliability: ev.score_reliability,
                        score_rule_knowledge: ev.score_rule_knowledge,
                      });
                      setShowForm(false);
                    }}
                      className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30
                                 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                      Bearbeiten
                    </button>
                  )}
                  {ev.status === 'draft' && (
                    <button onClick={() => deleteEvaluation(ev.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30
                                 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}