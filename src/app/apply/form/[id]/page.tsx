'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';

interface Question {
  id: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'scale' | 'yesno';
  label: string;
  required: boolean;
  options?: string[];
}

interface CustomForm {
  id: string;
  title: string;
  department: string;
  description: string | null;
  questions: Question[];
  is_active: boolean;
}

const DEPT_LABELS: Record<string, string> = {
  moderation: 'Moderation Team', social_media: 'Social Media Team',
  event: 'Event Team', development: 'Development Team',
};

export default function CustomFormPage() {
  const params = useParams();
  const id     = params?.id as string;
  const [form, setForm]       = useState<CustomForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});

  const supabase = createClientSupabaseClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('custom_forms').select('*').eq('id', id).single();
      setForm(data);
      setLoading(false);
    }
    if (id) load();
  }, [id]);

  function setAnswer(qId: string, val: any) {
    setAnswers(p => ({ ...p, [qId]: val }));
    setErrors(p => { const n = { ...p }; delete n[qId]; return n; });
  }

  function toggleCheckbox(qId: string, option: string) {
    const current: string[] = answers[qId] || [];
    setAnswer(qId, current.includes(option) ? current.filter(o => o !== option) : [...current, option]);
  }

  async function submit() {
    if (!form) return;
    const newErrors: Record<string, string> = {};
    form.questions.forEach(q => {
      if (q.required) {
        const v = answers[q.id];
        if (!v || (Array.isArray(v) && v.length === 0) || String(v).trim() === '') {
          newErrors[q.id] = 'Dieses Feld ist erforderlich.';
        }
      }
    });
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setSubmitting(true);
    await supabase.from('custom_form_responses').insert({ form_id: form.id, answers });
    setSubmitted(true);
    setSubmitting(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-gray-400">Lade...</div>
    </div>
  );

  if (!form) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-6xl mb-4">❌</p>
        <h1 className="text-white font-bold text-2xl mb-2">Formular nicht gefunden</h1>
        <p className="text-gray-400 text-sm">Dieses Formular existiert nicht oder wurde gelöscht.</p>
      </div>
    </div>
  );

  if (!form.is_active) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-6xl mb-4">🔒</p>
        <h1 className="text-white font-bold text-2xl mb-2">Formular geschlossen</h1>
        <p className="text-gray-400 text-sm">Dieses Bewerbungsformular ist aktuell nicht aktiv.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-6xl mb-4">✅</p>
        <h1 className="text-white font-bold text-2xl mb-2">Bewerbung eingegangen!</h1>
        <p className="text-gray-400 text-sm">Deine Bewerbung wurde erfolgreich übermittelt. Wir melden uns bei dir.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1117] py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6">
          <h1 className="text-white font-bold text-2xl mb-1">{form.title}</h1>
          {form.description && <p className="text-gray-400 text-sm mb-3">{form.description}</p>}
          <span className="text-xs px-2 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/30">
            {DEPT_LABELS[form.department] || form.department}
          </span>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {form.questions.map((q, idx) => (
            <div key={q.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-3">
              <label className="text-white text-sm font-medium flex items-start gap-1">
                <span className="text-gray-500 text-xs mt-0.5">{idx + 1}.</span>
                <span>{q.label}{q.required && <span className="text-red-400 ml-1">*</span>}</span>
              </label>

              {q.type === 'text' && (
                <input value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
              )}
              {q.type === 'textarea' && (
                <textarea value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} rows={4}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              )}
              {q.type === 'select' && (
                <select value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Bitte wählen...</option>
                  {(q.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {q.type === 'radio' && (
                <div className="space-y-2">
                  {(q.options || []).map(o => (
                    <label key={o} className="flex items-center gap-3 cursor-pointer bg-[#0f1117] rounded-lg px-4 py-2.5 hover:bg-white/5 transition">
                      <input type="radio" name={q.id} value={o} checked={answers[q.id] === o} onChange={() => setAnswer(q.id, o)} className="accent-blue-500" />
                      <span className="text-white text-sm">{o}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'checkbox' && (
                <div className="space-y-2">
                  {(q.options || []).map(o => (
                    <label key={o} className="flex items-center gap-3 cursor-pointer bg-[#0f1117] rounded-lg px-4 py-2.5 hover:bg-white/5 transition">
                      <input type="checkbox" checked={(answers[q.id] || []).includes(o)} onChange={() => toggleCheckbox(q.id, o)} className="accent-blue-500" />
                      <span className="text-white text-sm">{o}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'scale' && (
                <div className="space-y-2">
                  <div className="flex gap-1 justify-between">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button key={n} onClick={() => setAnswer(q.id, n)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${answers[q.id] === n ? 'bg-blue-600 text-white' : 'bg-[#0f1117] text-gray-400 hover:bg-white/10'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Schlecht</span><span>Ausgezeichnet</span>
                  </div>
                </div>
              )}
              {q.type === 'yesno' && (
                <div className="grid grid-cols-2 gap-2">
                  {['Ja', 'Nein'].map(o => (
                    <button key={o} onClick={() => setAnswer(q.id, o)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition border ${answers[q.id] === o ? o === 'Ja' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-[#0f1117] text-gray-400 border-white/10 hover:bg-white/5'}`}>
                      {o === 'Ja' ? '✅ Ja' : '❌ Nein'}
                    </button>
                  ))}
                </div>
              )}

              {errors[q.id] && <p className="text-red-400 text-xs">{errors[q.id]}</p>}
            </div>
          ))}
        </div>

        <button onClick={submit} disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl text-sm transition">
          {submitting ? 'Wird gesendet...' : '📤 Bewerbung absenden'}
        </button>
      </div>
    </div>
  );
}