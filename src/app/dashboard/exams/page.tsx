'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { ROLE_HIERARCHY } from '@/lib/permissions';
import { UserRole } from '@/types';

const DEPARTMENTS = [
  { key: 'moderator',        label: 'Moderation',  icon: '🛡️' },
  { key: 'developer',        label: 'Development',  icon: '💻' },
  { key: 'content_producer', label: 'Content',      icon: '📱' },
  { key: 'event_organizer',  label: 'Event',        icon: '🎉' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  written_pending:   { label: 'Schriftlich ausstehend',  color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  written_submitted: { label: 'Schriftlich eingereicht', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  oral_pending:      { label: 'Mündlich ausstehend',     color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  oral_done:         { label: 'Mündlich abgeschlossen',  color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  passed:            { label: '✓ Bestanden',              color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  failed:            { label: '✗ Nicht bestanden',        color: 'text-red-400 bg-red-500/10 border-red-500/30' },
};

type View = 'list' | 'create' | 'edit' | 'detail' | 'oral' | 'practical';

export default function ExamsPage() {
  const [myRole, setMyRole]   = useState<UserRole | null>(null);
  const [myId, setMyId]       = useState('');
  const [myDepts, setMyDepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState<View>('list');
  const [exams, setExams]     = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  // Detail
  const [selectedExam, setSelectedExam]       = useState<any>(null);
  const [writtenQs, setWrittenQs]             = useState<any[]>([]);
  const [oralQs, setOralQs]                   = useState<any[]>([]);
  const [sessions, setSessions]               = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  // Create / Edit Form
  const [form, setForm]               = useState({ title: '', description: '', department: 'moderator' });
  const [writtenForm, setWrittenForm] = useState<{ id: number; question: string }[]>([]);
  const [oralForm, setOralForm]       = useState<{ id: number; question: string; sample_answer: string }[]>([]);
  const [saving, setSaving]           = useState(false);
  const [candidateId, setCandidateId] = useState('');

  // Oral
  const [oralIndex, setOralIndex]     = useState(0);
  const [showAnswer, setShowAnswer]   = useState(false);
  const [oralResults, setOralResults] = useState<Record<string, { passed: boolean; note: string }>>({});

  // Practical
  const [practicalPassed, setPracticalPassed] = useState<boolean | null>(null);
  const [practicalNotes, setPracticalNotes]   = useState('');
  const [overallNotes, setOverallNotes]       = useState('');

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
    const { data: m } = await supabase.from('profiles').select('id, username, role, departments').eq('is_active', true).order('username');
    setMembers(m || []);
    await loadExams();
    setLoading(false);
  }

  async function loadExams() {
    const { data } = await supabase.from('exams')
      .select('*, creator:created_by(username)')
      .order('created_at', { ascending: false });
    setExams(data || []);
  }

  async function loadDetail(exam: any) {
    setSelectedExam(exam);
    const { data: wq } = await supabase.from('exam_written_questions').select('*').eq('exam_id', exam.id).order('order_index');
    const { data: oq } = await supabase.from('exam_oral_questions').select('*').eq('exam_id', exam.id).order('order_index');
    const { data: s } = await supabase.from('exam_sessions')
      .select('*, candidate:candidate_id(username, role), examiner:examiner_id(username)')
      .eq('exam_id', exam.id).order('created_at', { ascending: false });
    setWrittenQs(wq || []);
    setOralQs(oq || []);
    setSessions(s || []);
    setView('detail');
  }

  useEffect(() => { load(); }, []);

  // Nur Junior Management+ darf verwalten
  const canManage = myRole ? ROLE_HIERARCHY[myRole] >= 80 : false;

  // Prüfungen filtern: nur eigene Abteilung sehen
  const visibleExams = exams.filter(e => myDepts.includes(e.department) || myRole === 'top_management');

  // ─── CREATE ────────────────────────────────────────────────────────────────
  function openCreate() {
    setForm({ title: '', description: '', department: myDepts[0] || 'moderator' });
    setWrittenForm([]);
    setOralForm([]);
    setView('create');
  }

  // ─── EDIT ──────────────────────────────────────────────────────────────────
  async function openEdit(exam: any) {
    setSelectedExam(exam);
    setForm({ title: exam.title, description: exam.description || '', department: exam.department });
    const { data: wq } = await supabase.from('exam_written_questions').select('*').eq('exam_id', exam.id).order('order_index');
    const { data: oq } = await supabase.from('exam_oral_questions').select('*').eq('exam_id', exam.id).order('order_index');
    setWrittenForm((wq || []).map((q: any) => ({ id: q.id, question: q.question })));
    setOralForm((oq || []).map((q: any) => ({ id: q.id, question: q.question, sample_answer: q.sample_answer || '' })));
    setView('edit');
  }

  async function saveExam(isEdit: boolean) {
    if (!form.title.trim()) return;
    setSaving(true);

    if (isEdit && selectedExam) {
      // Update Grunddaten
      await supabase.from('exams').update({
        title: form.title, description: form.description || null, department: form.department,
      }).eq('id', selectedExam.id);

      // Fragen löschen und neu erstellen
      await supabase.from('exam_written_questions').delete().eq('exam_id', selectedExam.id);
      await supabase.from('exam_oral_questions').delete().eq('exam_id', selectedExam.id);

      if (writtenForm.filter(q => q.question.trim()).length > 0) {
        await supabase.from('exam_written_questions').insert(
          writtenForm.filter(q => q.question.trim()).map((q, i) => ({
            exam_id: selectedExam.id, question: q.question, order_index: i,
          }))
        );
      }
      if (oralForm.filter(q => q.question.trim()).length > 0) {
        await supabase.from('exam_oral_questions').insert(
          oralForm.filter(q => q.question.trim()).map((q, i) => ({
            exam_id: selectedExam.id, question: q.question,
            sample_answer: q.sample_answer || null, order_index: i,
          }))
        );
      }
      showMsg('✅ Prüfung aktualisiert!');
      await loadExams();
      setView('list');
    } else {
      const { data: exam } = await supabase.from('exams').insert({
        title: form.title, description: form.description || null,
        department: form.department, created_by: myId,
      }).select().single();

      if (exam) {
        if (writtenForm.filter(q => q.question.trim()).length > 0) {
          await supabase.from('exam_written_questions').insert(
            writtenForm.filter(q => q.question.trim()).map((q, i) => ({
              exam_id: exam.id, question: q.question, order_index: i,
            }))
          );
        }
        if (oralForm.filter(q => q.question.trim()).length > 0) {
          await supabase.from('exam_oral_questions').insert(
            oralForm.filter(q => q.question.trim()).map((q, i) => ({
              exam_id: exam.id, question: q.question,
              sample_answer: q.sample_answer || null, order_index: i,
            }))
          );
        }
        showMsg('✅ Prüfung erstellt!');
        await loadExams();
        setView('list');
      }
    }
    setSaving(false);
  }

  // ─── SESSION ERSTELLEN ────────────────────────────────────────────────────
  async function createSession() {
    if (!candidateId || !selectedExam) return;
    setSaving(true);
    const { data: session } = await supabase.from('exam_sessions').insert({
      exam_id: selectedExam.id, candidate_id: candidateId, examiner_id: myId,
    }).select().single();
    if (session) {
      const link = `${window.location.origin}/pruefung/${session.token}`;
      await navigator.clipboard.writeText(link);
      showMsg('✅ Link kopiert! Schick ihn dem Kandidaten per Discord DM.');
      await loadDetail(selectedExam);
      setCandidateId('');
    }
    setSaving(false);
  }

  // ─── SESSION LÖSCHEN ─────────────────────────────────────────────────────
  async function deleteSession(sessionId: string) {
    if (!confirm('Prüfling wirklich entfernen?')) return;
    await supabase.from('exam_sessions').delete().eq('id', sessionId);
    setSessions(p => p.filter(s => s.id !== sessionId));
    showMsg('✅ Prüfling entfernt.');
  }

  // ─── MÜNDLICHE PRÜFUNG ────────────────────────────────────────────────────
  function startOral(session: any) {
    setSelectedSession(session);
    setOralResults(session.oral_results || {});
    setOralIndex(0);
    setShowAnswer(false);
    setView('oral');
  }

  function rateOral(passed: boolean) {
    const q = oralQs[oralIndex];
    setOralResults(p => ({ ...p, [q.id]: { passed, note: p[q.id]?.note || '' } }));
  }

  async function finishOral() {
    if (!selectedSession) return;
    setSaving(true);
    await supabase.from('exam_sessions').update({
      oral_results: oralResults,
      oral_completed_at: new Date().toISOString(),
      status: 'oral_done',
    }).eq('id', selectedSession.id);
    showMsg('✅ Mündlicher Teil abgeschlossen!');
    await loadDetail(selectedExam);
    setView('detail');
    setSaving(false);
  }

  // ─── PRAKTISCHER TEIL ─────────────────────────────────────────────────────
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
      practical_passed: practicalPassed,
      practical_notes: practicalNotes || null,
      practical_completed_at: new Date().toISOString(),
      overall_notes: overallNotes || null,
      status: overallOk ? 'passed' : 'failed',
      completed_at: new Date().toISOString(),
    }).eq('id', selectedSession.id);
    showMsg(`✅ Prüfung abgeschlossen – ${overallOk ? 'BESTANDEN' : 'NICHT BESTANDEN'}!`);
    await loadDetail(selectedExam);
    setView('detail');
    setSaving(false);
  }

  async function deleteExam(id: string) {
    if (!confirm('Prüfung wirklich löschen?')) return;
    await supabase.from('exams').delete().eq('id', id);
    setExams(p => p.filter(e => e.id !== id));
    showMsg('✅ Prüfung gelöscht.');
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;
  if (!canManage) return <div className="text-red-400 text-center py-12">Nur Junior Management+ kann Prüfungen verwalten.</div>;

  // ─── FORMULAR (CREATE & EDIT) ──────────────────────────────────────────────
  if (view === 'create' || view === 'edit') {
    const isEdit = view === 'edit';
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView(isEdit ? 'list' : 'list')} className="text-gray-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-2xl font-bold text-white">{isEdit ? 'Prüfung bearbeiten' : 'Neue Prüfung erstellen'}</h1>
        </div>

        {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>{msg.text}</div>}

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
              {DEPARTMENTS.filter(d => myRole === 'top_management' || myDepts.includes(d.key)).map(d =>
                <option key={d.key} value={d.key}>{d.icon} {d.label}</option>
              )}
            </select>
          </div>
        </div>

        {/* Schriftliche Fragen */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">📝 Schriftliche Fragen</h3>
              <p className="text-gray-400 text-xs">Kandidat beantwortet über den Link</p>
            </div>
            <button onClick={() => setWrittenForm(p => [...p, { id: Date.now(), question: '' }])}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">+ Frage</button>
          </div>
          {writtenForm.map((q, i) => (
            <div key={q.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-blue-400 text-xs font-medium">Frage {i + 1}</span>
                <button onClick={() => setWrittenForm(p => p.filter(fq => fq.id !== q.id))} className="text-gray-500 hover:text-red-400 text-xs transition">Entfernen</button>
              </div>
              <textarea value={q.question} onChange={e => setWrittenForm(p => p.map(fq => fq.id === q.id ? { ...fq, question: e.target.value } : fq))}
                placeholder="Schriftliche Frage..." rows={2}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
          ))}
          {writtenForm.length === 0 && <div className="text-center py-5 bg-[#1a1d27] border border-dashed border-white/10 rounded-xl"><p className="text-gray-500 text-sm">Noch keine schriftlichen Fragen</p></div>}
        </div>

        {/* Mündliche Fragen */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-medium">🎤 Mündliche Fragen</h3>
              <p className="text-gray-400 text-xs">Nur der Prüfer sieht diese + Musterlösungen</p>
            </div>
            <button onClick={() => setOralForm(p => [...p, { id: Date.now(), question: '', sample_answer: '' }])}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">+ Frage</button>
          </div>
          {oralForm.map((q, i) => (
            <div key={q.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-purple-400 text-xs font-medium">Frage {i + 1}</span>
                <button onClick={() => setOralForm(p => p.filter(fq => fq.id !== q.id))} className="text-gray-500 hover:text-red-400 text-xs transition">Entfernen</button>
              </div>
              <textarea value={q.question} onChange={e => setOralForm(p => p.map(fq => fq.id === q.id ? { ...fq, question: e.target.value } : fq))}
                placeholder="Mündliche Frage..." rows={2}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              <textarea value={q.sample_answer} onChange={e => setOralForm(p => p.map(fq => fq.id === q.id ? { ...fq, sample_answer: e.target.value } : fq))}
                placeholder="Musterlösung (nur für den Prüfer sichtbar)..." rows={2}
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

  // ─── MÜNDLICHE PRÜFUNG VIEW ───────────────────────────────────────────────
  if (view === 'oral' && selectedSession) {
    const q = oralQs[oralIndex];
    const currentResult = oralResults[q?.id];
    const answered = Object.keys(oralResults).length;
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('detail')} className="text-gray-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">🎤 Mündlicher Teil</h1>
            <p className="text-gray-400 text-sm">Kandidat: <span className="text-blue-400 font-medium">{selectedSession.candidate?.username}</span></p>
          </div>
        </div>
        {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>{msg.text}</div>}
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Fortschritt</span>
            <span className="text-white text-sm font-bold">{oralIndex + 1} / {oralQs.length}</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 mb-3">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${((oralIndex + 1) / oralQs.length) * 100}%` }} />
          </div>
          <div className="flex gap-1 flex-wrap">
            {oralQs.map((_, i) => {
              const r = oralResults[oralQs[i]?.id];
              return (
                <button key={i} onClick={() => { setOralIndex(i); setShowAnswer(false); }}
                  className={`w-8 h-8 rounded text-xs font-bold transition ${i === oralIndex ? 'bg-blue-600 text-white' : r?.passed === true ? 'bg-green-500/30 text-green-400 border border-green-500/40' : r?.passed === false ? 'bg-red-500/30 text-red-400 border border-red-500/40' : 'bg-white/5 text-gray-500'}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
        {q && (
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-6 space-y-4">
            <span className="text-blue-400 text-xs font-bold bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded">Frage {oralIndex + 1}</span>
            <p className="text-white text-lg font-medium leading-relaxed">{q.question}</p>
            {q.sample_answer && (
              <div>
                <button onClick={() => setShowAnswer(p => !p)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${showAnswer ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
                  {showAnswer ? '🙈 Ausblenden' : '👁️ Musterlösung anzeigen'}
                </button>
                {showAnswer && (
                  <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                    <p className="text-yellow-400 text-xs font-bold mb-1">📋 Musterlösung</p>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{q.sample_answer}</p>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => rateOral(true)}
                className={`py-4 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 ${currentResult?.passed === true ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'}`}>
                ✅ Bestanden
              </button>
              <button onClick={() => rateOral(false)}
                className={`py-4 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 ${currentResult?.passed === false ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'}`}>
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
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition">Weiter →</button>
          ) : (
            <button onClick={finishOral} disabled={saving || answered === 0}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-2.5 rounded-lg text-sm transition">
              {saving ? 'Speichern...' : '✅ Mündlichen Teil abschließen'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── PRAKTISCHER TEIL VIEW ────────────────────────────────────────────────
  if (view === 'practical' && selectedSession) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('detail')} className="text-gray-400 hover:text-white transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">🔧 Praktischer Teil</h1>
            <p className="text-gray-400 text-sm">Kandidat: <span className="text-blue-400 font-medium">{selectedSession.candidate?.username}</span></p>
          </div>
        </div>
        {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>{msg.text}</div>}
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-6 space-y-5">
          <p className="text-white font-medium">Bewertung des praktischen Teils</p>
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
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Notizen zum praktischen Teil</label>
            <textarea value={practicalNotes} onChange={e => setPracticalNotes(e.target.value)}
              placeholder="Was wurde getestet? Wie hat sich der Kandidat geschlagen?" rows={3}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Gesamteindruck</label>
            <textarea value={overallNotes} onChange={e => setOverallNotes(e.target.value)}
              placeholder="Allgemeiner Eindruck des Kandidaten..." rows={3}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
          </div>
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
    const passed = sessions.filter(s => s.status === 'passed').length;
    const failed = sessions.filter(s => s.status === 'failed').length;
    return (
      <div className="max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="text-gray-400 hover:text-white transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
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
        {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>{msg.text}</div>}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{sessions.length}</p>
            <p className="text-gray-400 text-xs mt-1">Gesamt</p>
          </div>
          <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{passed}</p>
            <p className="text-gray-400 text-xs mt-1">Bestanden</p>
          </div>
          <div className="bg-[#1a1d27] border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{failed}</p>
            <p className="text-gray-400 text-xs mt-1">Nicht bestanden</p>
          </div>
        </div>
        <div className="bg-[#1a1d27] border border-blue-500/20 rounded-xl p-5">
          <h3 className="text-white font-medium mb-3">🚀 Prüfung für Kandidaten starten</h3>
          <div className="flex gap-3">
            <select value={candidateId} onChange={e => setCandidateId(e.target.value)}
              className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">Kandidat auswählen...</option>
              {members.filter(m => m.id !== myId).map(m => (
                <option key={m.id} value={m.id}>{m.username}</option>
              ))}
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
            <div className="space-y-2">
              {sessions.map(s => {
                const st = STATUS_LABELS[s.status] || STATUS_LABELS['written_pending'];
                const oralVals = Object.values(s.oral_results || {}) as any[];
                const oralPct = oralVals.length > 0 ? Math.round(oralVals.filter((r: any) => r.passed).length / oralVals.length * 100) : null;
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
                        <button onClick={() => deleteSession(s.id)}
                          className="text-xs px-2 py-1 rounded border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 transition">
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {s.status === 'written_submitted' && (
                        <button onClick={() => startOral(s)}
                          className="text-xs px-3 py-1.5 rounded-lg border bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20 transition">
                          🎤 Mündlichen Teil starten
                        </button>
                      )}
                      {s.status === 'oral_done' && (
                        <button onClick={() => startPractical(s)}
                          className="text-xs px-3 py-1.5 rounded-lg border bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20 transition">
                          🔧 Praktischen Teil starten
                        </button>
                      )}
                      {oralPct !== null && <span className="text-xs text-gray-400 self-center">Mündlich: {oralPct}%</span>}
                      {s.status === 'passed' || s.status === 'failed' ? <span className="text-xs text-gray-400 self-center">Praktisch: {s.practical_passed ? '✅' : '❌'}</span> : null}
                    </div>
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
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Neue Prüfung
        </button>
      </div>
      {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>{msg.text}</div>}
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
                      <button onClick={() => loadDetail(exam)}
                        className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                        Öffnen
                      </button>
                      <button onClick={() => openEdit(exam)}
                        className="bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                        ✏️
                      </button>
                      <button onClick={() => deleteExam(exam.id)}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                        🗑️
                      </button>
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