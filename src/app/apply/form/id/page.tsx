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

const DEPT_LABELS: Record<string, string> = {
  moderation: 'Moderation Team',
  social_media: 'Social Media Team',
  event: 'Event Team',
  development: 'Development Team',
};

export default function CustomFormPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [form, setForm] = useState<CustomForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
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
      setLoading(true);

      const { data, error } = await supabase
        .from('custom_forms')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        setForm(null);
        setLoading(false);
        return;
      }

      setForm(data as CustomForm);
      setLoading(false);
    };

    load();
  }, [id]);

  function setAnswer(qId: string, val: any) {
    setAnswers(p => ({ ...p, [qId]: val }));
    setErrors(p => {
      const n = { ...p };
      delete n[qId];
      return n;
    });
  }

  function toggleCheckbox(qId: string, option: string) {
    const current: string[] = answers[qId] || [];
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
      if (q.required) {
        const v = answers[q.id];
        if (!v || (Array.isArray(v) && v.length === 0) || String(v).trim() === '') {
          newErrors[q.id] = 'Dieses Feld ist erforderlich.';
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    await supabase.from('custom_form_responses').insert({
      form_id: form.id,
      answers,
    });

    setSubmitting(false);
    setSubmitted(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center text-gray-400">
        Lade...
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center text-gray-400">
        Formular nicht gefunden
      </div>
    );
  }

  if (!form.is_active) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center text-gray-400">
        Formular geschlossen
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center text-gray-400">
        Bewerbung erfolgreich gesendet
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6">
          <h1 className="text-white text-2xl font-bold">{form.title}</h1>
          {form.description && (
            <p className="text-gray-400 text-sm mt-2">{form.description}</p>
          )}
          <span className="text-xs text-blue-400 mt-2 inline-block">
            {DEPT_LABELS[form.department] || form.department}
          </span>
        </div>

        <div className="space-y-4">
          {form.questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-[#1a1d27] border border-white/10 rounded-xl p-5"
            >
              <label className="text-white text-sm font-medium">
                {idx + 1}. {q.label}{' '}
                {q.required && <span className="text-red-400">*</span>}
              </label>

              {q.type === 'text' && (
                <input
                  className="w-full mt-2 bg-[#0f1117] text-white p-2 rounded"
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                />
              )}

              {q.type === 'textarea' && (
                <textarea
                  className="w-full mt-2 bg-[#0f1117] text-white p-2 rounded"
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                />
              )}

              {errors[q.id] && (
                <p className="text-red-400 text-xs mt-1">{errors[q.id]}</p>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-xl"
        >
          {submitting ? 'Senden...' : 'Absenden'}
        </button>

      </div>
    </div>
  );
}