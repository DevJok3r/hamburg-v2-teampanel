'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

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

export default function CustomFormPage() {
  const params = useParams();

  // SAFE PARAM HANDLING (verhindert "is not a module" / undefined crashes)
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [form, setForm] = useState<CustomForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const { data, error } = await supabase
        .from('custom_forms')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      setForm(data as CustomForm);
      setLoading(false);
    };

    load();
  }, [id]);

  function setAnswer(qId: string, val: unknown) {
    setAnswers(prev => ({ ...prev, [qId]: val }));
    setErrors(prev => {
      const copy = { ...prev };
      delete copy[qId];
      return copy;
    });
  }

  function toggleCheckbox(qId: string, option: string) {
    const current = (answers[qId] as string[]) || [];
    setAnswer(
      qId,
      current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option]
    );
  }

  async function submit() {
    if (!form) return;

    const newErrors: Record<string, string> = {};

    form.questions.forEach(q => {
      if (!q.required) return;

      const v = answers[q.id];

      if (
        v === undefined ||
        v === null ||
        (Array.isArray(v) && v.length === 0) ||
        String(v).trim() === ''
      ) {
        newErrors[q.id] = 'Dieses Feld ist erforderlich.';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    await supabase.from('custom_form_responses').insert({
      form_id: form.id,
      answers
    });

    setSubmitting(false);
    setSubmitted(true);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-gray-400">Lade...</div>
    </div>
  );

  if (!form) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center text-white">Formular nicht gefunden</div>
    </div>
  );

  if (!form.is_active) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center text-white">
        Bewerbungsphase geschlossen
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center text-white">
        Bewerbung erfolgreich gesendet
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1117] py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6">
          <h1 className="text-white text-2xl font-bold">{form.title}</h1>
          {form.description && (
            <p className="text-gray-400 text-sm">{form.description}</p>
          )}
        </div>

        <div className="space-y-4">
          {form.questions.map((q, idx) => (
            <div key={q.id} className="bg-[#1a1d27] p-5 rounded-xl">
              <label className="text-white text-sm">
                {idx + 1}. {q.label}
              </label>

              {q.type === 'text' && (
                <input
                  className="w-full mt-2 bg-[#0f1117] text-white p-2 rounded"
                  value={(answers[q.id] as string) || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                />
              )}

              {q.type === 'textarea' && (
                <textarea
                  className="w-full mt-2 bg-[#0f1117] text-white p-2 rounded"
                  value={(answers[q.id] as string) || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                />
              )}

              {errors[q.id] && (
                <p className="text-red-400 text-xs mt-1">
                  {errors[q.id]}
                </p>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-lg"
        >
          {submitting ? 'Sende...' : 'Absenden'}
        </button>
      </div>
    </div>
  );
}