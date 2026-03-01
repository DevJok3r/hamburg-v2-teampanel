'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { ROLE_HIERARCHY } from '@/lib/permissions';
import { UserRole } from '@/types';

const DEPARTMENTS = [
  { key: 'moderation_team',  label: 'Moderation',  icon: '🛡️' },
  { key: 'development_team', label: 'Development',  icon: '💻' },
  { key: 'content_team',     label: 'Content',      icon: '📱' },
  { key: 'event_team',       label: 'Event',        icon: '🎉' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  written_pending:   { label: 'Schriftlich ausstehend',  color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  written_submitted: { label: 'Schriftlich eingereicht', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  oral_done:         { label: 'Mündlich abgeschlossen',  color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  passed:            { label: '✓ Bestanden',              color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  failed:            { label: '✗ Nicht bestanden',        color: 'text-red-400 bg-red-500/10 border-red-500/30' },
};

type QuestionType = 'open' | 'multiple_choice' | 'true_false';
type View = 'list' | 'create' | 'edit' | 'detail' | 'oral' | 'practical' | 'requests';

interface WrittenQuestion {
  id: number | string;
  question: string;
  type: QuestionType;
  options: string[];
  correct_answer: string;
  section?: string;
}

// ─── QUESTION EDITOR (außerhalb damit kein Focus-Loss) ────────────────────
function QuestionEditor({ q, i, onUpdate, onUpdateOption, onRemove }: {
  q: WrittenQuestion;
  i: number;
  onUpdate: (id: number | string, field: string, value: any) => void;
  onUpdateOption: (qId: number | string, idx: number, value: string) => void;
  onRemove: (id: number | string) => void;
}) {
  return (
    <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
            q.type === 'open' ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' :
            q.type === 'multiple_choice' ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' :
            'text-green-400 bg-green-500/10 border-green-500/30'}`}>
            {q.type === 'open' ? '📝 Offen' : q.type === 'multiple_choice' ? '🔘 Multiple Choice' : '✅ Wahr/Falsch'}
          </span>
          <span className="text-gray-500 text-xs">Frage {i + 1}</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={q.type} onChange={e => {
            const t = e.target.value as QuestionType;
            onUpdate(q.id, 'type', t);
            if (t === 'multiple_choice') onUpdate(q.id, 'options', ['', '', '', '']);
            if (t === 'true_false') { onUpdate(q.id, 'options', []); onUpdate(q.id, 'correct_answer', 'true'); }
            if (t === 'open') { onUpdate(q.id, 'options', []); onUpdate(q.id, 'correct_answer', ''); }
          }} className="bg-[#0f1117] border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none">
            <option value="open">📝 Offene Frage</option>
            <option value="multiple_choice">🔘 Multiple Choice</option>
            <option value="true_false">✅ Wahr/Falsch</option>
          </select>
          <button onClick={() => onRemove(q.id)} className="text-gray-500 hover:text-red-400 text-xs transition">✕</button>
        </div>
      </div>

      <input value={q.section || ''} onChange={e => onUpdate(q.id, 'section', e.target.value)}
        placeholder="Abschnitt (z.B. Teil A – Multiple Choice) optional..."
        className="w-full bg-[#0f1117] border border-white/5 rounded-lg px-3 py-1.5 text-gray-400 placeholder-gray-600 text-xs focus:outline-none focus:border-white/20" />

      <textarea value={q.question} onChange={e => onUpdate(q.id, 'question', e.target.value)}
        placeholder="Frage eingeben..." rows={2}
        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />

      {q.type === 'multiple_choice' && (
        <div className="space-y-2">
          <p className="text-gray-400 text-xs">Antwortoptionen (richtige markieren):</p>
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <button onClick={() => onUpdate(q.id, 'correct_answer', String(oi))}
                className={`w-6 h-6 rounded-full border-2 flex-shrink-0 transition flex items-center justify-center ${q.correct_answer === String(oi) ? 'bg-green-500 border-green-500' : 'border-gray-600 hover:border-green-500'}`}>
                {q.correct_answer === String(oi) && <span className="text-white text-xs">✓</span>}
              </button>
              <span className="text-gray-400 text-xs w-5">{['A', 'B', 'C', 'D'][oi]})</span>
              <input value={opt} onChange={e => onUpdateOption(q.id, oi, e.target.value)}
                placeholder={`Option ${['A', 'B', 'C', 'D'][oi]}...`}
                className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          ))}
        </div>
      )}

      {q.type === 'true_false' && (
        <div>
          <p className="text-gray-400 text-xs mb-2">Richtige Antwort:</p>
          <div className="flex gap-2">
            <button onClick={() => onUpdate(q.id, 'correct_answer', 'true')}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${q.correct_answer === 'true' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-green-500/10'}`}>
              ✅ Wahr
            </button>
            <button onClick={() => onUpdate(q.id, 'correct_answer', 'false')}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${q.correct_answer === 'false' ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-red-500/10'}`}>
              ❌ Falsch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamsPage() {
  const [myRole, setMyRole]   = useState<UserRole | null>(null);
  const [myId, setMyId]       = useState('');
  const [myDepts, setMyDepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState<View>('list');
  const [exams, setExams]     = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  const [selectedExam, setSelectedExam]       = useState<any>(null);
  const [writtenQs, setWrittenQs]             = useState<any[]>([]);
  const [oralQs, setOralQs]                   = useState<any[]>([]);
  const [sessions, setSessions]               = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showAnswersFor, setShowAnswersFor]   = useState<string | null>(null);

  const [form, setForm]               = useState({ title: '', description: '', department: 'moderation_team' });
  const [writtenForm, setWrittenForm] = useState<WrittenQuestion[]>([]);
  const [oralForm, setOralForm]       = useState<{ id: number; question: string; sample_answer: string }[]>([]);
  const [saving, setSaving]           = useState(false);
  const [candidateId, setCandidateId] = useState('');

  const [oralIndex, setOralIndex]     = useState(0);
  const [showAnswer, setShowAnswer]   = useState(false);
  const [oralResults, setOralResults] = useState<Record<string, { passed: boolean; note: string }>>({});

  const [practicalPassed, setPracticalPassed] = useState<boolean | null>(null);
  const [practicalNotes, setPracticalNotes]   = useState('');
  const [overallNotes, setOverallNotes]       = useState('');

  // Requests
  const [requests, setRequests]         = useState<any[]>([]);
  const [requestExamId, setRequestExamId]     = useState('');
  const [requestCandidateId, setRequestCandidateId] = useState('');
  const [requestNotes, setRequestNotes]       = useState('');

  const supabase = createClientSupabaseClient();

  function showMsg(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: p } = await supabase.from('profiles').select('role, departments').eq('id', user.id).single();
    if (p) { setMyRole(p.role as UserRole); setMyDepts(p.departments || []); }
    const { data: m } = await supabase.from('profiles').select('id, username, role').eq('is_active', true).order('username');
    setMembers(m || []);
    await loadExams();
    setLoading(false);
  }

  async function loadExams() {
    const { data } = await supabase.from('exams').select('*, creator:created_by(username)').order('created_at', { ascending: false });
    setExams(data || []);
  }

  async function loadRequests() {
    const { data } = await supabase.from('exam_requests')
      .select('*, exam:exam_id(title, department), requester:requested_by(username), candidate:candidate_id(username), reviewer:reviewed_by(username)')
      .order('created_at', { ascending: false });
    setRequests(data || []);
  }

  async function loadDetail(exam: any) {
    setSelectedExam(exam);
    setShowAnswersFor(null);
    const { data: wq } = await supabase.from('exam_written_questions').select('*').eq('exam_id', exam.id).order('order_index');
    const { data: oq } = await supabase.from('exam_oral_questions').select('*').eq('exam_id', exam.id).order('order_index');
    const { data: s }  = await supabase.from('exam_sessions')
      .select('*, candidate:candidate_id(username, role), examiner:examiner_id(username)')
      .eq('exam_id', exam.id).order('created_at', { ascending: false });
    setWrittenQs(wq || []);
    setOralQs(oq || []);
    setSessions(s || []);
    setView('detail');
  }

  useEffect(() => { load(); }, []);

  const canManage    = myRole ? ROLE_HIERARCHY[myRole] >= 80 : false;
  const isTopMgmt    = myRole === 'top_management';
  const visibleExams = exams.filter(e =>
    isTopMgmt ||
    (myRole === 'management' && myDepts.includes(e.department)) ||
    (myRole === 'junior_management' && myDepts.includes(e.department))
  );

  // ─── QUESTION HELPERS ─────────────────────────────────────────────────────
  function newQuestion(type: QuestionType): WrittenQuestion {
    return { id: Date.now(), question: '', type, options: type === 'multiple_choice' ? ['', '', '', ''] : [], correct_answer: type === 'true_false' ? 'true' : '', section: '' };
  }

  function updateWrittenQ(id: number | string, field: string, value: any) {
    setWrittenForm(p => p.map(q => q.id === id ? { ...q, [field]: value } : q));
  }

  function updateOption(qId: number | string, idx: number, value: string) {
    setWrittenForm(p => p.map(q => {
      if (q.id !== qId) return q;
      const opts = [...q.options];
      opts[idx] = value;
      return { ...q, options: opts };
    }));
  }

  // ─── CREATE / EDIT ────────────────────────────────────────────────────────
  function openCreate() {
    setSelectedExam(null);
    setForm({ title: '', description: '', department: myDepts[0] || 'moderation_team' });
    setWrittenForm([]);
    setOralForm([]);
    setView('create');
  }

  async function openEdit(exam: any) {
    setSelectedExam(exam);
    setForm({ title: exam.title, description: exam.description || '', department: exam.department });
    const { data: wq } = await supabase.from('exam_written_questions').select('*').eq('exam_id', exam.id).order('order_index');
    const { data: oq } = await supabase.from('exam_oral_questions').select('*').eq('exam_id', exam.id).order('order_index');
    setWrittenForm((wq || []).map((q: any) => ({ id: q.id, question: q.question, type: q.type || 'open', options: q.options || [], correct_answer: q.correct_answer || '', section: q.section || '' })));
    setOralForm((oq || []).map((q: any) => ({ id: q.id, question: q.question, sample_answer: q.sample_answer || '' })));
    setView('edit');
  }

  async function saveExam(isEdit: boolean) {
    if (!form.title.trim()) return;
    setSaving(true);

    let targetId = isEdit && selectedExam ? selectedExam.id : null;

    if (isEdit && targetId) {
      await supabase.from('exams').update({ title: form.title, description: form.description || null, department: form.department }).eq('id', targetId);
      await supabase.from('exam_written_questions').delete().eq('exam_id', targetId);
      await supabase.from('exam_oral_questions').delete().eq('exam_id', targetId);
    } else {
      const { data: exam } = await supabase.from('exams').insert({
        title: form.title, description: form.description || null, department: form.department, created_by: myId,
      }).select().single();
      if (!exam) { setSaving(false); return; }
      targetId = (exam as any).id;
    }

    const wqs = writtenForm.filter(q => q.question.trim());
    if (wqs.length > 0) {
      await supabase.from('exam_written_questions').insert(
        wqs.map((q, i) => ({ exam_id: targetId, question: q.question, type: q.type, options: q.options, correct_answer: q.correct_answer, section: q.section || null, order_index: i }))
      );
    }
    const oqs = oralForm.filter(q => q.question.trim());
    if (oqs.length > 0) {
      await supabase.from('exam_oral_questions').insert(
        oqs.map((q, i) => ({ exam_id: targetId, question: q.question, sample_answer: q.sample_answer || null, order_index: i }))
      );
    }

    showMsg(isEdit ? '✅ Prüfung aktualisiert!' : '✅ Prüfung erstellt!');
    await loadExams();
    setView('list');
    setSaving(false);
  }

  // ─── SESSION ──────────────────────────────────────────────────────────────
  async function createSession() {
    if (!candidateId || !selectedExam) return;
    setSaving(true);
    const { data: session } = await supabase.from('exam_sessions').insert({
      exam_id: selectedExam.id, candidate_id: candidateId, examiner_id: myId,
    }).select().single();
    if (session) {
      const link = `${window.location.origin}/pruefung/${(session as any).token}`;
      await navigator.clipboard.writeText(link);
      showMsg('✅ Link kopiert! Schick ihn dem Kandidaten per Discord DM.');
      await loadDetail(selectedExam);
      setCandidateId('');
    }
    setSaving(false);
  }

  async function deleteSession(sessionId: string) {
    if (!confirm('Prüfling wirklich entfernen?')) return;
    await supabase.from('exam_sessions').delete().eq('id', sessionId);
    setSessions(p => p.filter(s => s.id !== sessionId));
    showMsg('✅ Prüfling entfernt.');
  }

  async function deleteExam(id: string) {
    if (!confirm('Prüfung wirklich löschen?')) return;
    await supabase.from('exams').delete().eq('id', id);
    setExams(p => p.filter(e => e.id !== id));
    showMsg('✅ Prüfung gelöscht.');
  }

  // ─── REQUESTS ─────────────────────────────────────────────────────────────
  async function submitRequest() {
    if (!requestExamId || !requestCandidateId) return;
    setSaving(true);
    await supabase.from('exam_requests').insert({
      exam_id: requestExamId, requested_by: myId,
      candidate_id: requestCandidateId, notes: requestNotes || null,
    });
    showMsg('✅ Anfrage gesendet! Top Management wird benachrichtigt.');
    setRequestExamId('');
    setRequestCandidateId('');
    setRequestNotes('');
    await loadRequests();
    setSaving(false);
  }

  async function reviewRequest(id: string, approved: boolean) {
    setSaving(true);
    if (approved) {
      const req = requests.find(r => r.id === id);
      if (req) {
        const { data: session } = await supabase.from('exam_sessions').insert({
          exam_id: req.exam_id, candidate_id: req.candidate_id, examiner_id: req.requested_by,
        }).select().single();
        if (session) {
          const link = `${window.location.origin}/pruefung/${(session as any).token}`;
          await navigator.clipboard.writeText(link);
          showMsg('✅ Genehmigt! Link wurde kopiert.');
        }
      }
    } else {
      showMsg('❌ Anfrage abgelehnt.');
    }
    await supabase.from('exam_requests').update({
      status: approved ? 'approved' : 'rejected',
      reviewed_by: myId, reviewed_at: new Date().toISOString(),
    }).eq('id', id);
    await loadRequests();
    setSaving(false);
  }

  // ─── MÜNDLICH ─────────────────────────────────────────────────────────────
  function startOral(session: any) {
    setSelectedSession(session);
    setOralResults(session.oral_results || {});
    setOralIndex(0);
    setShowAnswer(false);
    setView('oral');
  }

  async function finishOral() {
    if (!selectedSession) return;
    setSaving(true);
    await supabase.from('exam_sessions').update({
      oral_results: oralResults, oral_completed_at: new Date().toISOString(), status: 'oral_done',
    }).eq('id', selectedSession.id);
    showMsg('✅ Mündlicher Teil abgeschlossen!');
    await loadDetail(selectedExam);
    setView('detail');
    setSaving(false);
  }

  // ─── PRAKTISCH ────────────────────────────────────────────────────────────
  function startPractical(session: any) {
    setSelectedSession(session);
    setPracticalPassed(session.practical_passed ?? null);
    setPracticalNotes(session.practical_notes || '');
    setOverallNotes(session.overall_notes || '');
    setView('practical');
  }

  async function finishPractical() {
    if (!selectedSession || practicalPassed === null) return;
    setSaving(true);
    const oralVals = Object.values(selectedSession.oral_results || {}) as any[];
    const oralOk = oralVals.length > 0 ? oralVals.filter(r => r.passed).length / oralVals.length >= 0.7 : true;
    const overallOk = oralOk && practicalPassed;
    await supabase.from('exam_sessions').update({
      practical_passed: practicalPassed, practical_notes: practicalNotes || null,
      practical_completed_at: new Date().toISOString(), overall_notes: overallNotes || null,
      status: overallOk ? 'passed' : 'failed', completed_at: new Date().toISOString(),
    }).eq('id', selectedSession.id);
    showMsg(`✅ Prüfung abgeschlossen – ${overallOk ? 'BESTANDEN' : 'NICHT BESTANDEN'}!`);
    await loadDetail(selectedExam);
    setView('detail');
    setSaving(false);
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;
  if (!canManage) return <div className="text-red-400 text-center py-12">Nur Junior Management+ kann Prüfungen verwalten.</div>;

  // ─── MSG COMPONENT ────────────────────────────────────────────────────────
  const MsgBar = () => msg ? (
    <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>{msg.text}</div>
  ) : null;

  const BackBtn = ({ to }: { to: View }) => (
    <button onClick={() => setView(to)} className="text-gray-400 hover:text-white transition">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
    </button>
  );

  // ─── REQUESTS VIEW ────────────────────────────────────────────────────────
  if (view === 'requests') {
    const pending = requests.filter(r => r.status === 'pending');
    const done    = requests.filter(r => r.status !== 'pending');
    return (
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <BackBtn to="list" />
          <div>
            <h1 className="text-2xl font-bold text-white">Prüfungsanordnungen</h1>
            <p className="text-gray-400 text-sm">Anfragen von Management · {pending.length} ausstehend</p>
          </div>
        </div>
        <MsgBar />

        {/* Neue Anfrage stellen (nicht Top Management) */}
        {!isTopMgmt && (
          <div className="bg-[#1a1d27] border border-blue-500/20 rounded-xl p-5 space-y-3">
            <h3 className="text-white font-medium">📋 Prüfung anordnen</h3>
            <p className="text-gray-400 text-xs">Stelle eine Anfrage an Top Management um eine Prüfung für einen Kandidaten zu genehmigen.</p>
            <select value={requestExamId} onChange={e => setRequestExamId(e.target.value)}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">Prüfung auswählen...</option>
              {visibleExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select value={requestCandidateId} onChange={e => setRequestCandidateId(e.target.value)}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">Kandidat auswählen...</option>
              {members.filter(m => m.id !== myId).map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
            </select>
            <textarea value={requestNotes} onChange={e => setRequestNotes(e.target.value)}
              placeholder="Begründung / Notizen (optional)..." rows={2}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            <button onClick={submitRequest} disabled={saving || !requestExamId || !requestCandidateId}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition">
              📤 Anfrage senden
            </button>
          </div>
        )}

        {/* Ausstehende Anfragen (Top Management) */}
        {isTopMgmt && pending.length > 0 && (
          <div className="bg-[#1a1d27] border border-yellow-500/20 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">⏳ Ausstehende Anfragen ({pending.length})</h3>
            <div className="space-y-3">
              {pending.map(r => (
                <div key={r.id} className="bg-[#0f1117] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-medium text-sm">{r.exam?.title}</p>
                      <p className="text-gray-400 text-xs">Kandidat: <span className="text-blue-400">{r.candidate?.username}</span></p>
                      <p className="text-gray-400 text-xs">Angefordert von: <span className="text-purple-400">{r.requester?.username}</span> · {new Date(r.created_at).toLocaleDateString('de-DE')}</p>
                      {r.notes && <p className="text-gray-500 text-xs mt-1 italic">"{r.notes}"</p>}
                    </div>
                    <span className="text-xs px-2 py-1 rounded border text-yellow-400 bg-yellow-500/10 border-yellow-500/30">Ausstehend</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => reviewRequest(r.id, true)} disabled={saving}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium py-2 rounded-lg text-xs transition">
                      ✅ Genehmigen & Link kopieren
                    </button>
                    <button onClick={() => reviewRequest(r.id, false)} disabled={saving}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-medium py-2 rounded-lg text-xs transition">
                      ❌ Ablehnen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isTopMgmt && pending.length === 0 && (
          <div className="text-center py-8 bg-[#1a1d27] border border-white/10 rounded-xl">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-gray-400 text-sm">Keine ausstehenden Anfragen</p>
          </div>
        )}

        {/* Erledigte Anfragen */}
        {done.length > 0 && (
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">📋 Erledigt ({done.length})</h3>
            <div className="space-y-2">
              {done.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white text-sm">{r.exam?.title} → <span className="text-blue-400">{r.candidate?.username}</span></p>
                    <p className="text-gray-500 text-xs">von {r.requester?.username} · {new Date(r.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded border ${r.status === 'approved' ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
                    {r.status === 'approved' ? '✓ Genehmigt' : '✗ Abgelehnt'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── CREATE / EDIT VIEW ───────────────────────────────────────────────────
  if (view === 'create' || view === 'edit') {
    const isEdit = view === 'edit';
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <BackBtn to="list" />
          <h1 className="text-2xl font-bold text-white">{isEdit ? 'Prüfung bearbeiten' : 'Neue Prüfung erstellen'}</h1>
        </div>
        <MsgBar />
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-medium">Grundeinstellungen</h3>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="Titel der Prüfung..."
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Beschreibung (optional)..." rows={2}
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Abteilung</label>
            <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
              {DEPARTMENTS.filter(d => isTopMgmt || myDepts.includes(d.key)).map(d =>
                <option key={d.key} value={d.key}>{d.icon} {d.label}</option>
              )}
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">📝 Schriftliche Fragen</h3>
              <p className="text-gray-400 text-xs">{writtenForm.length} Fragen</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setWrittenForm(p => [...p, newQuestion('open')])} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition">+ Offen</button>
              <button onClick={() => setWrittenForm(p => [...p, newQuestion('multiple_choice')])} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition">+ MC</button>
              <button onClick={() => setWrittenForm(p => [...p, newQuestion('true_false')])} className="bg-green-700 hover:bg-green-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg transition">+ W/F</button>
            </div>
          </div>
          {writtenForm.map((q, i) => (
            <QuestionEditor key={q.id} q={q} i={i} onUpdate={updateWrittenQ} onUpdateOption={updateOption} onRemove={id => setWrittenForm(p => p.filter(fq => fq.id !== id))} />
          ))}
          {writtenForm.length === 0 && <div className="text-center py-5 bg-[#1a1d27] border border-dashed border-white/10 rounded-xl"><p className="text-gray-500 text-sm">Fragen hinzufügen mit den Buttons oben</p></div>}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">🎤 Mündliche Fragen</h3>
              <p className="text-gray-400 text-xs">{oralForm.length} Fragen</p>
            </div>
            <button onClick={() => setOralForm(p => [...p, { id: Date.now(), question: '', sample_answer: '' }])} className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">+ Frage</button>
          </div>
          {oralForm.map((q, i) => (
            <div key={q.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-orange-400 text-xs font-medium">Mündlich {i + 1}</span>
                <button onClick={() => setOralForm(p => p.filter(fq => fq.id !== q.id))} className="text-gray-500 hover:text-red-400 text-xs transition">✕</button>
              </div>
              <textarea value={q.question} onChange={e => setOralForm(p => p.map(fq => fq.id === q.id ? { ...fq, question: e.target.value } : fq))}
                placeholder="Mündliche Frage..." rows={2}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-orange-500 resize-none" />
              <textarea value={q.sample_answer} onChange={e => setOralForm(p => p.map(fq => fq.id === q.id ? { ...fq, sample_answer: e.target.value } : fq))}
                placeholder="Musterlösung (nur Prüfer sieht das)..." rows={2}
                className="w-full bg-[#0f1117] border border-yellow-500/20 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-yellow-500 resize-none" />
            </div>
          ))}
          {oralForm.length === 0 && <div className="text-center py-5 bg-[#1a1d27] border border-dashed border-white/10 rounded-xl"><p className="text-gray-500 text-sm">Noch keine mündlichen Fragen</p></div>}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setView('list')} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm transition">Abbrechen</button>
          <button onClick={() => saveExam(isEdit)} disabled={saving || !form.title.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition">
            {saving ? 'Speichern...' : isEdit ? '💾 Änderungen speichern' : '✅ Prüfung erstellen'}
          </button>
        </div>
      </div>
    );
  }

  // ─── MÜNDLICH VIEW ────────────────────────────────────────────────────────
  if (view === 'oral' && selectedSession) {
    const q = oralQs[oralIndex];
    const currentResult = oralResults[q?.id];
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <BackBtn to="detail" />
          <div>
            <h1 className="text-xl font-bold text-white">🎤 Mündlicher Teil</h1>
            <p className="text-gray-400 text-sm">Kandidat: <span className="text-blue-400 font-medium">{selectedSession.candidate?.username}</span></p>
          </div>
        </div>
        <MsgBar />
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Fortschritt</span>
            <span className="text-white text-sm font-bold">{oralIndex + 1} / {oralQs.length}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 mb-3">
            <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${((oralIndex + 1) / oralQs.length) * 100}%` }} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {oralQs.map((_, i) => {
              const r = oralResults[oralQs[i]?.id];
              return (
                <button key={i} onClick={() => { setOralIndex(i); setShowAnswer(false); }}
                  className={`w-8 h-8 rounded text-xs font-bold transition ${i === oralIndex ? 'bg-orange-600 text-white' : r?.passed === true ? 'bg-green-500/30 text-green-400 border border-green-500/40' : r?.passed === false ? 'bg-red-500/30 text-red-400 border border-red-500/40' : 'bg-white/5 text-gray-500'}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
        {q && (
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-6 space-y-4">
            <p className="text-white text-lg font-medium leading-relaxed">{q.question}</p>
            {q.sample_answer && (
              <div>
                <button onClick={() => setShowAnswer(p => !p)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${showAnswer ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
                  {showAnswer ? '🙈 Ausblenden' : '👁️ Musterlösung'}
                </button>
                {showAnswer && (
                  <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                    <p className="text-yellow-400 text-xs font-bold mb-1">📋 Musterlösung</p>
                    <p className="text-white text-sm whitespace-pre-wrap">{q.sample_answer}</p>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setOralResults(p => ({ ...p, [q.id]: { passed: true, note: p[q.id]?.note || '' } }))}
                className={`py-4 rounded-xl border text-sm font-bold transition ${currentResult?.passed === true ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'}`}>
                ✅ Bestanden
              </button>
              <button onClick={() => setOralResults(p => ({ ...p, [q.id]: { passed: false, note: p[q.id]?.note || '' } }))}
                className={`py-4 rounded-xl border text-sm font-bold transition ${currentResult?.passed === false ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'}`}>
                ❌ Nicht bestanden
              </button>
            </div>
            <textarea value={oralResults[q.id]?.note || ''}
              onChange={e => { const note = e.target.value; setOralResults(p => ({ ...p, [q.id]: { passed: p[q.id]?.passed ?? false, note } })); }}
              placeholder="Notiz (optional)..." rows={2}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setOralIndex(p => Math.max(p - 1, 0)); setShowAnswer(false); }} disabled={oralIndex === 0}
            className="bg-white/5 hover:bg-white/10 disabled:opacity-30 text-gray-300 px-5 py-2.5 rounded-lg text-sm transition">← Zurück</button>
          {oralIndex < oralQs.length - 1 ? (
            <button onClick={() => { setOralIndex(p => p + 1); setShowAnswer(false); }}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium py-2.5 rounded-lg text-sm transition">Weiter →</button>
          ) : (
            <button onClick={finishOral} disabled={saving || Object.keys(oralResults).length === 0}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-sm transition">
              {saving ? 'Speichern...' : '✅ Mündlichen Teil abschließen'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── PRAKTISCH VIEW ───────────────────────────────────────────────────────
  if (view === 'practical' && selectedSession) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <BackBtn to="detail" />
          <div>
            <h1 className="text-xl font-bold text-white">🔧 Praktischer Teil</h1>
            <p className="text-gray-400 text-sm">Kandidat: <span className="text-blue-400 font-medium">{selectedSession.candidate?.username}</span></p>
          </div>
        </div>
        <MsgBar />
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setPracticalPassed(true)}
              className={`py-6 rounded-xl border text-sm font-bold transition flex flex-col items-center gap-2 ${practicalPassed === true ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'}`}>
              <span className="text-3xl">✅</span>Bestanden
            </button>
            <button onClick={() => setPracticalPassed(false)}
              className={`py-6 rounded-xl border text-sm font-bold transition flex flex-col items-center gap-2 ${practicalPassed === false ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'}`}>
              <span className="text-3xl">❌</span>Nicht bestanden
            </button>
          </div>
          <textarea value={practicalNotes} onChange={e => setPracticalNotes(e.target.value)}
            placeholder="Notizen zum praktischen Teil..." rows={3}
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
          <textarea value={overallNotes} onChange={e => setOverallNotes(e.target.value)}
            placeholder="Gesamteindruck..." rows={3}
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
          <button onClick={finishPractical} disabled={saving || practicalPassed === null}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3 rounded-lg text-sm transition">
            {saving ? 'Auswerten...' : '🎓 Prüfung abschließen & Gesamtergebnis speichern'}
          </button>
        </div>
      </div>
    );
  }

  // ─── DETAIL VIEW ──────────────────────────────────────────────────────────
  if (view === 'detail' && selectedExam) {
    const dept = DEPARTMENTS.find(d => d.key === selectedExam.department);
    return (
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackBtn to="list" />
            <div>
              <h1 className="text-2xl font-bold text-white">{selectedExam.title}</h1>
              <p className="text-gray-400 text-sm">{dept?.icon} {dept?.label} · {writtenQs.length} schriftl. · {oralQs.length} mündl.</p>
            </div>
          </div>
          <button onClick={() => openEdit(selectedExam)}
            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
            ✏️ Bearbeiten
          </button>
        </div>
        <MsgBar />
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Gesamt', val: sessions.length, color: 'border-white/10', text: 'text-white' },
            { label: 'Bestanden', val: sessions.filter(s => s.status === 'passed').length, color: 'border-green-500/20', text: 'text-green-400' },
            { label: 'Nicht bestanden', val: sessions.filter(s => s.status === 'failed').length, color: 'border-red-500/20', text: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className={`bg-[#1a1d27] border ${s.color} rounded-xl p-4 text-center`}>
              <p className={`text-2xl font-bold ${s.text}`}>{s.val}</p>
              <p className="text-gray-400 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="bg-[#1a1d27] border border-blue-500/20 rounded-xl p-5">
          <h3 className="text-white font-medium mb-3">🚀 Prüfung starten</h3>
          <div className="flex gap-3">
            <select value={candidateId} onChange={e => setCandidateId(e.target.value)}
              className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">Kandidat auswählen...</option>
              {members.filter(m => m.id !== myId).map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
            </select>
            <button onClick={createSession} disabled={!candidateId || saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition">
              🔗 Link generieren
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-2">Link wird automatisch kopiert.</p>
        </div>
        {sessions.length > 0 && (
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">📊 Prüflinge</h3>
            <div className="space-y-3">
              {sessions.map(s => {
                const st = STATUS_LABELS[s.status] || STATUS_LABELS['written_pending'];
                const oralVals = Object.values(s.oral_results || {}) as any[];
                const oralPct = oralVals.length > 0 ? Math.round(oralVals.filter((r: any) => r.passed).length / oralVals.length * 100) : null;
                const showingAnswers = showAnswersFor === s.id;
                return (
                  <div key={s.id} className="bg-[#0f1117] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {s.candidate?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{s.candidate?.username}</p>
                          <p className="text-gray-500 text-xs">Prüfer: {s.examiner?.username} · {new Date(s.created_at).toLocaleDateString('de-DE')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded border font-medium ${st.color}`}>{st.label}</span>
                        <button onClick={() => deleteSession(s.id)} className="text-xs px-2 py-1 rounded border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 transition">🗑️</button>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {s.status !== 'written_pending' && (
                        <button onClick={() => setShowAnswersFor(showingAnswers ? null : s.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition ${showingAnswers ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' : 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20'}`}>
                          📄 {showingAnswers ? 'Ausblenden' : 'Schriftliche Antworten'}
                        </button>
                      )}
                      {s.status === 'written_submitted' && (
                        <button onClick={() => startOral(s)} className="text-xs px-3 py-1.5 rounded-lg border bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20 transition">
                          🎤 Mündlichen Teil starten
                        </button>
                      )}
                      {s.status === 'oral_done' && (
                        <button onClick={() => startPractical(s)} className="text-xs px-3 py-1.5 rounded-lg border bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20 transition">
                          🔧 Praktischen Teil starten
                        </button>
                      )}
                      {oralPct !== null && <span className="text-xs text-gray-400 self-center">Mündlich: {oralPct}%</span>}
                      {(s.status === 'passed' || s.status === 'failed') && (
                        <span className="text-xs text-gray-400 self-center">Praktisch: {s.practical_passed ? '✅' : '❌'}</span>
                      )}
                    </div>
                    {showingAnswers && (
                      <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
                        <p className="text-white text-xs font-bold">📝 Schriftliche Antworten</p>
                        {writtenQs.map((q, qi) => {
                          const answer = s.written_answers?.[q.id];
                          const isCorrect = (q.type === 'multiple_choice' || q.type === 'true_false') ? answer === q.correct_answer : null;
                          return (
                            <div key={q.id} className={`rounded-lg p-4 border ${isCorrect === true ? 'bg-green-500/5 border-green-500/20' : isCorrect === false ? 'bg-red-500/5 border-red-500/20' : 'bg-[#1a1d27] border-white/5'}`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="text-gray-400 text-xs font-medium">
                                  {q.section && <span className="text-blue-400 mr-1">[{q.section}]</span>}
                                  Frage {qi + 1}: {q.question}
                                </p>
                                {isCorrect !== null && <span className={`text-xs flex-shrink-0 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>{isCorrect ? '✓ Richtig' : '✗ Falsch'}</span>}
                              </div>
                              {q.type === 'multiple_choice' && (
                                <div className="space-y-1">
                                  {(q.options || []).map((opt: string, oi: number) => (
                                    <div key={oi} className={`text-xs px-2 py-1 rounded flex items-center gap-2 ${answer === String(oi) && q.correct_answer === String(oi) ? 'bg-green-500/20 text-green-400' : answer === String(oi) ? 'bg-red-500/20 text-red-400' : q.correct_answer === String(oi) ? 'bg-green-500/10 text-green-500' : 'text-gray-500'}`}>
                                      <span>{['A', 'B', 'C', 'D'][oi]})</span><span>{opt}</span>
                                      {answer === String(oi) && <span className="ml-auto">{q.correct_answer === String(oi) ? '✓' : '✗'}</span>}
                                      {answer !== String(oi) && q.correct_answer === String(oi) && <span className="ml-auto text-green-500">← Richtig</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {q.type === 'true_false' && (
                                <div className="flex gap-2">
                                  {['true', 'false'].map(v => (
                                    <span key={v} className={`text-xs px-3 py-1 rounded border ${answer === v && q.correct_answer === v ? 'bg-green-500/20 text-green-400 border-green-500/30' : answer === v ? 'bg-red-500/20 text-red-400 border-red-500/30' : q.correct_answer === v ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'text-gray-600 border-white/5'}`}>
                                      {v === 'true' ? '✅ Wahr' : '❌ Falsch'}{answer === v && ' (gewählt)'}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(!q.type || q.type === 'open') && (
                                <p className="text-white text-sm whitespace-pre-wrap">{answer || <span className="text-gray-500 italic">Keine Antwort</span>}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── LIST VIEW ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Prüfungen</h1>
          <p className="text-gray-400 text-sm mt-1">Schriftlich · Mündlich · Praktisch</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadRequests(); setView('requests'); }}
            className={`font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2 border ${isTopMgmt && requests.filter(r => r.status === 'pending').length > 0 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
            📋 Anordnungen
            {isTopMgmt && requests.filter(r => r.status === 'pending').length > 0 && (
              <span className="bg-yellow-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">{requests.filter(r => r.status === 'pending').length}</span>
            )}
          </button>
          <button onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Neue Prüfung
          </button>
        </div>
      </div>
      <MsgBar />
      {DEPARTMENTS.map(dept => {
        const deptExams = visibleExams.filter(e => e.department === dept.key);
        if (deptExams.length === 0) return null;
        return (
          <div key={dept.key}>
            <h2 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">{dept.icon} {dept.label}</h2>
            <div className="space-y-2">
              {deptExams.map(exam => (
                <div key={exam.id} className="bg-[#1a1d27] border border-white/10 hover:border-white/20 rounded-xl p-5 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold">{exam.title}</h3>
                      {exam.description && <p className="text-gray-400 text-xs mt-0.5">{exam.description}</p>}
                      <p className="text-gray-500 text-xs mt-1">von {exam.creator?.username} · {new Date(exam.created_at).toLocaleDateString('de-DE')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadDetail(exam)} className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">Öffnen</button>
                      <button onClick={() => openEdit(exam)} className="bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 text-xs font-medium px-3 py-1.5 rounded-lg transition">✏️</button>
                      <button onClick={() => deleteExam(exam.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {visibleExams.length === 0 && (
        <div className="text-center py-12 bg-[#1a1d27] border border-white/10 rounded-xl">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-white font-medium">Noch keine Prüfungen</p>
          <p className="text-gray-500 text-sm mt-1">Erstelle die erste Prüfung.</p>
        </div>
      )}
    </div>
  );
}