'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { use } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PruefungPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [loading, setLoading]     = useState(true);
  const [session, setSession]     = useState<any>(null);
  const [exam, setExam]           = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers]     = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    async function load() {
      const { data: s, error: sErr } = await supabase.from('exam_sessions').select('*').eq('token', token).single();
      if (sErr || !s) { setError('Prüfungslink ungültig oder abgelaufen.'); setLoading(false); return; }
      if (s.written_submitted_at) { setSubmitted(true); setLoading(false); return; }
      const { data: e } = await supabase.from('exams').select('*').eq('id', s.exam_id).single();
      const { data: q } = await supabase.from('exam_written_questions').select('*').eq('exam_id', s.exam_id).order('order_index');
      setSession(s);
      setExam(e);
      setQuestions(q || []);
      if (s.written_answers && Object.keys(s.written_answers).length > 0) setAnswers(s.written_answers);
      setLoading(false);
    }
    load();
  }, [token]);

  async function submit() {
    const unanswered = questions.filter(q => !answers[q.id]?.toString().trim());
    if (unanswered.length > 0) {
      if (!confirm(`${unanswered.length} Frage(n) noch nicht beantwortet. Trotzdem einreichen?`)) return;
    }
    setSaving(true);
    await supabase.from('exam_sessions').update({
      written_answers: answers, written_submitted_at: new Date().toISOString(), status: 'written_submitted',
    }).eq('token', token);
    setSubmitted(true);
    setSaving(false);
  }

  async function saveProgress() {
    if (!session) return;
    await supabase.from('exam_sessions').update({ written_answers: answers }).eq('token', token);
  }

  if (loading) return <div className="min-h-screen bg-[#0f1117] flex items-center justify-center"><div className="text-gray-400">Lade Prüfung...</div></div>;
  if (error)   return <div className="min-h-screen bg-[#0f1117] flex items-center justify-center"><div className="text-center"><p className="text-4xl mb-4">❌</p><p className="text-white font-bold text-xl">Prüfungslink ungültig oder abgelaufen.</p></div></div>;
  if (submitted) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <p className="text-6xl mb-6">✅</p>
        <h1 className="text-white font-bold text-2xl mb-2">Schriftlicher Teil eingereicht!</h1>
        <p className="text-gray-400 text-sm">Deine Antworten wurden gespeichert. Das Team meldet sich bei dir für den mündlichen und praktischen Teil.</p>
        <div className="mt-6 bg-[#1a1d27] border border-white/10 rounded-xl p-4"><p className="text-gray-400 text-xs">Du kannst dieses Fenster schließen.</p></div>
      </div>
    </div>
  );

  const answeredCount = questions.filter(q => answers[q.id]?.toString().trim()).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  // Abschnitte gruppieren
  let lastSection = '';

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <div className="bg-[#1a1d27] border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-lg">{exam?.title}</h1>
              <p className="text-gray-400 text-xs">Schriftlicher Teil · Hamburg V2</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-sm">{answeredCount} / {questions.length}</p>
              <p className="text-gray-400 text-xs">beantwortet</p>
            </div>
          </div>
          <div className="mt-3 w-full bg-white/10 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        {exam?.description && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-blue-300 text-sm">{exam.description}</p>
          </div>
        )}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
          <p className="text-yellow-400 text-sm">ℹ️ Beantworte alle Fragen so ausführlich wie möglich. Deine Antworten werden automatisch gespeichert.</p>
        </div>

        {questions.map((q, i) => {
          const answered = !!answers[q.id]?.toString().trim();
          const showSection = q.section && q.section !== lastSection;
          if (q.section) lastSection = q.section;

          return (
            <div key={q.id}>
              {showSection && (
                <div className="mt-4 mb-2">
                  <h2 className="text-white font-bold text-sm border-b border-white/10 pb-2">{q.section}</h2>
                </div>
              )}
              <div className={`bg-[#1a1d27] border rounded-xl p-6 transition ${answered ? 'border-blue-500/30' : 'border-white/10'}`}>
                <div className="flex items-start gap-3 mb-4">
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${answered ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400'}`}>
                    {answered ? '✓' : i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        q.type === 'multiple_choice' ? 'bg-purple-500/20 text-purple-400' :
                        q.type === 'true_false' ? 'bg-green-500/20 text-green-400' :
                        'bg-blue-500/20 text-blue-400'}`}>
                        {q.type === 'multiple_choice' ? 'Multiple Choice' : q.type === 'true_false' ? 'Wahr/Falsch' : 'Offene Frage'}
                      </span>
                    </div>
                    <p className="text-white font-medium leading-relaxed">{q.question}</p>
                  </div>
                </div>

                {/* Multiple Choice */}
                {q.type === 'multiple_choice' && (
                  <div className="space-y-2">
                    {(q.options || []).map((opt: string, oi: number) => (
                      <button key={oi} onClick={() => { setAnswers(p => ({ ...p, [q.id]: String(oi) })); setTimeout(saveProgress, 500); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition ${
                          answers[q.id] === String(oi) ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-[#0f1117] border-white/10 text-gray-300 hover:bg-white/5 hover:border-white/20'}`}>
                        <span className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold ${answers[q.id] === String(oi) ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-600'}`}>
                          {answers[q.id] === String(oi) ? '✓' : ['A', 'B', 'C', 'D'][oi]}
                        </span>
                        <span className="text-sm">{opt}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Wahr/Falsch */}
                {q.type === 'true_false' && (
                  <div className="grid grid-cols-2 gap-3">
                    {[{ val: 'true', label: '✅ Wahr' }, { val: 'false', label: '❌ Falsch' }].map(opt => (
                      <button key={opt.val} onClick={() => { setAnswers(p => ({ ...p, [q.id]: opt.val })); setTimeout(saveProgress, 500); }}
                        className={`py-3 rounded-lg border text-sm font-medium transition ${
                          answers[q.id] === opt.val ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-[#0f1117] border-white/10 text-gray-300 hover:bg-white/5'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Offene Frage */}
                {q.type === 'open' && (
                  <textarea value={answers[q.id] || ''} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                    onBlur={saveProgress} placeholder="Deine Antwort..." rows={4}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none leading-relaxed" />
                )}
              </div>
            </div>
          );
        })}

        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Fortschritt</span>
            <span className={`font-medium ${answeredCount === questions.length ? 'text-green-400' : 'text-yellow-400'}`}>
              {answeredCount === questions.length ? '✅ Alle beantwortet' : `${questions.length - answeredCount} noch offen`}
            </span>
          </div>
          <button onClick={submit} disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-4 rounded-xl text-base transition shadow-lg shadow-green-600/20">
            {saving ? 'Einreichen...' : '📤 Schriftlichen Teil einreichen'}
          </button>
          <p className="text-gray-600 text-xs text-center">Nach dem Einreichen können Antworten nicht mehr geändert werden.</p>
        </div>
      </div>
    </div>
  );
}