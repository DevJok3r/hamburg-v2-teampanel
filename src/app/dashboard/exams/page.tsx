'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';

const DEPARTMENTS = [
  { key: 'moderation_team',   label: 'Moderation Team',   icon: '🛡️', color: 'blue' },
  { key: 'development_team',  label: 'Development Team',  icon: '💻', color: 'green' },
  { key: 'social_media_team', label: 'Social Media Team', icon: '📱', color: 'purple' },
  { key: 'event_team',        label: 'Event Team',        icon: '🎉', color: 'orange' },
];

const DEPT_COLORS: Record<string, string> = {
  blue:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  green:  'bg-green-500/10 text-green-400 border-green-500/30',
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

const EXAM_TYPES = [
  { key: 'written',    label: 'Schriftliche Prüfung',  icon: '📝', desc: 'Multiple Choice & offene Fragen' },
  { key: 'practical',  label: 'Praktische Prüfung',    icon: '🎮', desc: 'Aufgaben direkt im Spiel/System' },
  { key: 'oral',       label: 'Mündliche Prüfung',     icon: '🎤', desc: 'Gespräch mit dem Prüfer' },
  { key: 'scenario',   label: 'Szenario-Prüfung',      icon: '🎭', desc: 'Realistische Situationen meistern' },
];

const QUESTION_TYPES = [
  { key: 'multiple_choice', label: 'Multiple Choice' },
  { key: 'open',            label: 'Offene Frage' },
  { key: 'scenario',        label: 'Szenario' },
  { key: 'practical',       label: 'Praktisch' },
];

type View = 'overview' | 'department' | 'exam' | 'create_exam' | 'take_exam' | 'results';

export default function ExamsPage() {
  const [view, setView]               = useState<View>('overview');
  const [myRole, setMyRole]           = useState<UserRole | null>(null);
  const [myId, setMyId]               = useState<string>('');
  const [myDepts, setMyDepts]         = useState<string[]>([]);
  const [loading, setLoading]         = useState(true);
  const [exams, setExams]             = useState<any[]>([]);
  const [sessions, setSessions]       = useState<any[]>([]);
  const [members, setMembers]         = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [questions, setQuestions]     = useState<any[]>([]);

  // Create Exam Form
  const [createForm, setCreateForm] = useState({
    title: '', description: '', exam_type: 'written', department: '',
  });
  const [newQuestions, setNewQuestions] = useState<any[]>([]);

  // Take Exam
  const [candidateId, setCandidateId] = useState('');
  const [answers, setAnswers]         = useState<Record<string, string>>({});
  const [examNotes, setExamNotes]     = useState('');
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [examSubmitting, setExamSubmitting] = useState(false);

  const supabase = createClientSupabaseClient();
  const isTopManagement = myRole === 'top_management';

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: profile } = await supabase.from('profiles').select('role, departments').eq('id', user.id).single();
    if (profile) {
      setMyRole(profile.role as UserRole);
      setMyDepts(profile.departments || []);
    }
    const { data: allMembers } = await supabase.from('profiles').select('id, username, role, departments').eq('is_active', true).order('username');
    setMembers(allMembers || []);
    setLoading(false);
  }

  async function loadExams(dept: string) {
    const { data } = await supabase.from('exams').select('*, profiles!exams_created_by_fkey(username)').eq('department', dept).order('created_at', { ascending: false });
    setExams(data || []);
  }

  async function loadSessions(examId: string) {
    const { data } = await supabase
      .from('exam_sessions')
      .select('*, candidate:candidate_id(username, role), examiner:examiner_id(username)')
      .eq('exam_id', examId)
      .order('started_at', { ascending: false });
    setSessions(data || []);
  }

  async function loadQuestions(examId: string) {
    const { data } = await supabase.from('exam_questions').select('*').eq('exam_id', examId).order('order_index');
    setQuestions(data || []);
  }

  useEffect(() => { load(); }, []);

  const accessibleDepts = isTopManagement
    ? DEPARTMENTS
    : DEPARTMENTS.filter(d => myDepts.includes(d.key));

  async function createExam() {
    if (!createForm.title.trim() || !createForm.department) return;
    const { data: exam } = await supabase.from('exams').insert({
      title: createForm.title, description: createForm.description || null,
      exam_type: createForm.exam_type, department: createForm.department,
      created_by: myId,
    }).select().single();

    if (exam && newQuestions.length > 0) {
      const rows = newQuestions.map((q, i) => ({
        exam_id: exam.id, question: q.question, question_type: q.type,
        options: q.options?.length ? q.options : null,
        correct_answer: q.correct_answer || null,
        points: q.points || 1, order_index: i,
      }));
      await supabase.from('exam_questions').insert(rows);
    }

    setCreateForm({ title: '', description: '', exam_type: 'written', department: '' });
    setNewQuestions([]);
    loadExams(selectedDept);
    setView('department');
  }

  async function deleteExam(id: string) {
    await supabase.from('exams').delete().eq('id', id);
    loadExams(selectedDept);
  }

  async function startExamSession() {
    if (!candidateId || !selectedExam) return;
    setExamSubmitting(true);
    const maxScore = questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const { data: session } = await supabase.from('exam_sessions').insert({
      exam_id: selectedExam.id, candidate_id: candidateId,
      examiner_id: myId, status: 'in_progress',
      max_score: maxScore, answers: {},
    }).select().single();
    setSelectedSession(session);
    setAnswers({});
    setActiveQuestion(0);
    setExamSubmitting(false);
  }

  async function submitExam() {
    if (!selectedSession) return;
    setExamSubmitting(true);

    let score = 0;
    questions.forEach(q => {
      if (q.question_type === 'multiple_choice' && answers[q.id] === q.correct_answer) {
        score += q.points || 1;
      }
    });

    const maxScore = selectedSession.max_score || 1;
    const percentage = Math.round((score / maxScore) * 100);
    const status = percentage >= 70 ? 'passed' : 'failed';

    await supabase.from('exam_sessions').update({
      status, score, percentage, answers,
      notes: examNotes || null, completed_at: new Date().toISOString(),
    }).eq('id', selectedSession.id);

    await loadSessions(selectedExam.id);
    setSelectedSession(null);
    setAnswers({});
    setExamNotes('');
    setView('exam');
    setExamSubmitting(false);
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  if (!myRole || !['top_management', 'management', 'junior_management'].includes(myRole)) {
    return <div className="text-red-400 text-center py-12">Kein Zugriff.</div>;
  }

  // ─── ÜBERSICHT ────────────────────────────────────────────────────────────
  if (view === 'overview') {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-white">Prüfungen</h1>
          <p className="text-gray-400 text-sm mt-1">Wähle eine Abteilung um Prüfungen zu verwalten</p>
        </div>

        {accessibleDepts.length === 0 ? (
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-12 text-center">
            <p className="text-4xl mb-4">🔒</p>
            <p className="text-white font-medium mb-1">Keine Abteilung zugewiesen</p>
            <p className="text-gray-500 text-sm">Du hast noch keine Abteilung zugeteilt bekommen.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {accessibleDepts.map(dept => {
              const color = DEPT_COLORS[dept.color];
              return (
                <button key={dept.key} onClick={async () => {
                  setSelectedDept(dept.key);
                  await loadExams(dept.key);
                  setView('department');
                }}
                  className="bg-[#1a1d27] border border-white/10 hover:border-white/20 rounded-xl p-6 text-left transition group">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-4xl">{dept.icon}</span>
                    <div>
                      <h3 className="text-white font-bold text-lg">{dept.label}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded border ${color}`}>Zugriff gewährt</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm group-hover:text-white transition">
                    <span>Prüfungen verwalten</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const currentDept = DEPARTMENTS.find(d => d.key === selectedDept);

  // ─── ABTEILUNG ────────────────────────────────────────────────────────────
  if (view === 'department') {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('overview')} className="text-gray-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{currentDept?.icon} {currentDept?.label}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{exams.length} Prüfungen verfügbar</p>
          </div>
          <button onClick={() => {
            setCreateForm(p => ({ ...p, department: selectedDept }));
            setNewQuestions([]);
            setView('create_exam');
          }}
            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Prüfung
          </button>
        </div>

        {/* Prüfungstypen als Filter */}
        <div className="grid grid-cols-4 gap-3">
          {EXAM_TYPES.map(et => {
            const count = exams.filter(e => e.exam_type === et.key).length;
            return (
              <div key={et.key} className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 text-center">
                <p className="text-2xl mb-1">{et.icon}</p>
                <p className="text-white text-xs font-medium">{et.label}</p>
                <p className="text-blue-400 font-bold text-lg mt-1">{count}</p>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          {exams.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">Noch keine Prüfungen erstellt</div>
          ) : exams.map(exam => {
            const et = EXAM_TYPES.find(t => t.key === exam.exam_type);
            return (
              <div key={exam.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="text-3xl">{et?.icon}</span>
                    <div>
                      <h3 className="text-white font-semibold">{exam.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/30">
                          {et?.label}
                        </span>
                        <span className="text-gray-500 text-xs">von {exam.profiles?.username}</span>
                        <span className="text-gray-500 text-xs">{new Date(exam.created_at).toLocaleDateString('de-DE')}</span>
                      </div>
                      {exam.description && <p className="text-gray-400 text-xs mt-1">{exam.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={async () => {
                      setSelectedExam(exam);
                      await loadQuestions(exam.id);
                      await loadSessions(exam.id);
                      setView('exam');
                    }}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                      Öffnen
                    </button>
                    {(isTopManagement || exam.created_by === myId) && (
                      <button onClick={() => deleteExam(exam.id)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
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

  // ─── PRÜFUNG ERSTELLEN ────────────────────────────────────────────────────
  if (view === 'create_exam') {
    function addQuestion() {
      setNewQuestions(p => [...p, {
        id: Date.now(), question: '', type: 'multiple_choice',
        options: ['', '', '', ''], correct_answer: '', points: 1,
      }]);
    }
    function removeQuestion(idx: number) {
      setNewQuestions(p => p.filter((_, i) => i !== idx));
    }
    function updateQuestion(idx: number, field: string, value: any) {
      setNewQuestions(p => p.map((q, i) => i === idx ? { ...q, [field]: value } : q));
    }
    function updateOption(qIdx: number, oIdx: number, value: string) {
      setNewQuestions(p => p.map((q, i) => i === qIdx
        ? { ...q, options: q.options.map((o: string, oi: number) => oi === oIdx ? value : o) }
        : q));
    }

    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('department')} className="text-gray-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-white">Neue Prüfung erstellen</h1>
        </div>

        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-medium">Grundeinstellungen</h3>
          <input value={createForm.title} onChange={e => setCreateForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Titel der Prüfung..."
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
          <textarea value={createForm.description} onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Beschreibung (optional)..." rows={2}
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Prüfungstyp</label>
              <select value={createForm.exam_type} onChange={e => setCreateForm(p => ({ ...p, exam_type: e.target.value }))}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                {EXAM_TYPES.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Abteilung</label>
              <select value={createForm.department} onChange={e => setCreateForm(p => ({ ...p, department: e.target.value }))}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                {accessibleDepts.map(d => <option key={d.key} value={d.key}>{d.icon} {d.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Fragen */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">Fragen ({newQuestions.length})</h3>
            <button onClick={addQuestion}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Frage hinzufügen
            </button>
          </div>

          {newQuestions.map((q, idx) => (
            <div key={q.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-blue-400 text-xs font-medium">Frage {idx + 1}</span>
                <button onClick={() => removeQuestion(idx)} className="text-gray-500 hover:text-red-400 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <textarea value={q.question} onChange={e => updateQuestion(idx, 'question', e.target.value)}
                    placeholder="Frage eingeben..." rows={2}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                </div>
                <div className="space-y-2">
                  <select value={q.type} onChange={e => updateQuestion(idx, 'type', e.target.value)}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500">
                    {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-gray-400 text-xs">Punkte:</label>
                    <input type="number" min={1} max={10} value={q.points}
                      onChange={e => updateQuestion(idx, 'points', parseInt(e.target.value))}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>

              {q.type === 'multiple_choice' && (
                <div className="space-y-2">
                  <label className="text-gray-400 text-xs">Antwortoptionen (richtige markieren)</label>
                  {q.options.map((opt: string, oi: number) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`correct_${idx}`}
                        checked={q.correct_answer === opt && opt !== ''}
                        onChange={() => updateQuestion(idx, 'correct_answer', opt)}
                        className="accent-green-500 flex-shrink-0" />
                      <input value={opt} onChange={e => updateOption(idx, oi, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + oi)}...`}
                        className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500" />
                    </div>
                  ))}
                </div>
              )}

              {(q.type === 'open' || q.type === 'scenario' || q.type === 'practical') && (
                <p className="text-gray-500 text-xs bg-[#0f1117] rounded-lg p-3">
                  💡 Diese Frage wird manuell vom Prüfer bewertet.
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={() => setView('department')}
            className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm transition">
            Abbrechen
          </button>
          <button onClick={createExam} disabled={!createForm.title.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
            Prüfung erstellen
          </button>
        </div>
      </div>
    );
  }

  // ─── PRÜFUNG DETAIL ───────────────────────────────────────────────────────
  if (view === 'exam' && selectedExam) {
    const et = EXAM_TYPES.find(t => t.key === selectedExam.exam_type);
    const passed = sessions.filter(s => s.status === 'passed').length;
    const failed = sessions.filter(s => s.status === 'failed').length;
    const avgScore = sessions.filter(s => s.percentage != null).length > 0
      ? Math.round(sessions.filter(s => s.percentage != null).reduce((a, s) => a + s.percentage, 0) / sessions.filter(s => s.percentage != null).length)
      : null;

    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('department')} className="text-gray-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{et?.icon}</span>
              <h1 className="text-2xl font-bold text-white">{selectedExam.title}</h1>
            </div>
            <p className="text-gray-400 text-sm mt-0.5">{et?.label} · {questions.length} Fragen · {questions.reduce((a, q) => a + (q.points || 1), 0)} Punkte</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{sessions.length}</p>
            <p className="text-gray-400 text-xs mt-1">Durchgeführt</p>
          </div>
          <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{passed}</p>
            <p className="text-gray-400 text-xs mt-1">Bestanden</p>
          </div>
          <div className="bg-[#1a1d27] border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{failed}</p>
            <p className="text-gray-400 text-xs mt-1">Nicht bestanden</p>
          </div>
          <div className="bg-[#1a1d27] border border-blue-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{avgScore !== null ? `${avgScore}%` : '–'}</p>
            <p className="text-gray-400 text-xs mt-1">Ø Ergebnis</p>
          </div>
        </div>

        {/* Fragen Vorschau */}
        {questions.length > 0 && (
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">Fragenkatalog ({questions.length})</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {questions.map((q, i) => {
                const qt = QUESTION_TYPES.find(t => t.key === q.question_type);
                return (
                  <div key={q.id} className="flex items-start gap-3 bg-[#0f1117] rounded-lg px-4 py-2.5">
                    <span className="text-blue-400 text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-white text-sm flex-1">{q.question}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-gray-500 text-xs">{qt?.label}</span>
                      <span className="text-yellow-400 text-xs">{q.points}P</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Prüfung starten */}
        <div className="bg-[#1a1d27] border border-blue-500/20 rounded-xl p-5">
          <h3 className="text-white font-medium mb-3">🎓 Prüfung durchführen</h3>
          <div className="flex gap-3">
            <select value={candidateId} onChange={e => setCandidateId(e.target.value)}
              className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">Kandidat auswählen...</option>
              {members.filter(m => m.id !== myId).map(m => (
                <option key={m.id} value={m.id}>{m.username}</option>
              ))}
            </select>
            <button onClick={async () => { await startExamSession(); setView('take_exam'); }}
              disabled={!candidateId || examSubmitting}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Starten
            </button>
          </div>
        </div>

        {/* Ergebnisse */}
        {sessions.length > 0 && (
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">Bisherige Ergebnisse</h3>
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {s.candidate?.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{s.candidate?.username}</p>
                      <p className="text-gray-500 text-xs">Prüfer: {s.examiner?.username} · {new Date(s.started_at).toLocaleDateString('de-DE')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.status === 'in_progress' ? (
                      <span className="text-xs px-2 py-1 rounded border bg-yellow-500/10 text-yellow-400 border-yellow-500/30">Läuft</span>
                    ) : (
                      <>
                        <span className="text-gray-400 text-sm">{s.score}/{s.max_score} Punkte</span>
                        <span className={`text-xs px-2 py-1 rounded border font-bold
                          ${s.status === 'passed' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                          {s.percentage}% · {s.status === 'passed' ? 'Bestanden ✓' : 'Nicht bestanden ✗'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── PRÜFUNG ABNEHMEN ─────────────────────────────────────────────────────
  if (view === 'take_exam' && selectedSession) {
    const candidate = members.find(m => m.id === candidateId);
    const currentQ = questions[activeQuestion];
    const totalPoints = questions.reduce((a, q) => a + (q.points || 1), 0);

    return (
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-white font-bold text-lg">🎓 {selectedExam?.title}</h2>
              <p className="text-gray-400 text-sm">Kandidat: <span className="text-blue-400 font-medium">{candidate?.username}</span></p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs">Fortschritt</p>
              <p className="text-white font-bold">{activeQuestion + 1} / {questions.length}</p>
            </div>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${((activeQuestion + 1) / questions.length) * 100}%` }} />
          </div>
        </div>

        {/* Aktuelle Frage */}
        {currentQ && (
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-blue-400 text-xs font-bold bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">
                    Frage {activeQuestion + 1}
                  </span>
                  <span className="text-yellow-400 text-xs">{currentQ.points} {currentQ.points === 1 ? 'Punkt' : 'Punkte'}</span>
                  <span className="text-gray-500 text-xs">{QUESTION_TYPES.find(t => t.key === currentQ.question_type)?.label}</span>
                </div>
                <p className="text-white text-base font-medium leading-relaxed">{currentQ.question}</p>
              </div>
            </div>

            {currentQ.question_type === 'multiple_choice' && currentQ.options && (
              <div className="space-y-2 mt-4">
                {currentQ.options.filter((o: string) => o.trim()).map((opt: string, oi: number) => (
                  <button key={oi} onClick={() => setAnswers(p => ({ ...p, [currentQ.id]: opt }))}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition text-sm
                      ${answers[currentQ.id] === opt
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-[#0f1117] text-gray-300 border-white/10 hover:border-blue-500/50 hover:bg-white/5'}`}>
                    <span className="font-bold mr-2">{String.fromCharCode(65 + oi)}.</span> {opt}
                  </button>
                ))}
              </div>
            )}

            {(currentQ.question_type === 'open' || currentQ.question_type === 'scenario' || currentQ.question_type === 'practical') && (
              <div className="mt-4">
                <label className="text-gray-400 text-xs mb-2 block">Antwort / Beobachtung des Prüfers</label>
                <textarea value={answers[currentQ.id] || ''}
                  onChange={e => setAnswers(p => ({ ...p, [currentQ.id]: e.target.value }))}
                  placeholder="Antwort des Kandidaten oder Beobachtungen notieren..."
                  rows={4}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setActiveQuestion(p => Math.max(0, p - 1))}
            disabled={activeQuestion === 0}
            className="bg-white/5 hover:bg-white/10 disabled:opacity-30 text-gray-300 px-4 py-2 rounded-lg text-sm transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurück
          </button>

          <div className="flex gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setActiveQuestion(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition
                  ${i === activeQuestion ? 'bg-blue-600 text-white' : answers[questions[i]?.id] ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-500'}`}>
                {i + 1}
              </button>
            ))}
          </div>

          {activeQuestion < questions.length - 1 ? (
            <button onClick={() => setActiveQuestion(p => p + 1)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition flex items-center gap-2">
              Weiter
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <div /> 
          )}
        </div>

        {/* Abschluss */}
        {activeQuestion === questions.length - 1 && (
          <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-medium">✅ Prüfung abschließen</h3>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Abschließende Notizen (optional)</label>
              <textarea value={examNotes} onChange={e => setExamNotes(e.target.value)}
                placeholder="Gesamteindruck, Bemerkungen zur Prüfung..."
                rows={3}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-green-500 resize-none" />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-gray-400 text-sm">
                {Object.keys(answers).length}/{questions.length} Fragen beantwortet
              </p>
              <button onClick={submitExam} disabled={examSubmitting}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition flex items-center gap-2">
                {examSubmitting ? 'Auswerten...' : '🎓 Prüfung auswerten'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}