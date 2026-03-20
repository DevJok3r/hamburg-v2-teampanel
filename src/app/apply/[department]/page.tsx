'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { use } from 'react';

type FieldType = 'text' | 'textarea' | 'number' | 'scale' | 'yesno' | 'select' | 'email';

interface DBQuestion {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  section?: string;
}

interface DBForm {
  department: string;
  title: string;
  intro: string;
  questions: DBQuestion[];
}

const DEPT_COLORS: Record<string, { bg: string; border: string; text: string; button: string; scale_active: string }> = {
  moderation:  { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   button: 'bg-blue-600 hover:bg-blue-700',    scale_active: 'bg-blue-600 text-white border-blue-500' },
  social_media:{ bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', button: 'bg-purple-600 hover:bg-purple-700', scale_active: 'bg-purple-600 text-white border-purple-500' },
  event:       { bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   text: 'text-pink-400',   button: 'bg-pink-600 hover:bg-pink-700',    scale_active: 'bg-pink-600 text-white border-pink-500' },
  development: { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  button: 'bg-green-600 hover:bg-green-700',  scale_active: 'bg-green-600 text-white border-green-500' },
};

const DEPT_ICONS: Record<string, string> = {
  moderation: '🛡️', social_media: '📱', event: '🎉', development: '💻',
};

function ScaleField({ label, value, onChange, colors }: { label: string; value: string; onChange: (v: string) => void; colors: typeof DEPT_COLORS[string] }) {
  return (
    <div>
      <label className="text-gray-300 text-sm mb-3 block">{label} <span className="text-red-400">*</span></label>
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-xs">1</span>
        <div className="flex gap-1">
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} type="button" onClick={() => onChange(String(n))}
              className={`w-9 h-9 rounded-lg text-sm font-bold transition border ${value === String(n) ? colors.scale_active : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10'}`}>
              {n}
            </button>
          ))}
        </div>
        <span className="text-gray-500 text-xs">10</span>
      </div>
    </div>
  );
}

function YesNoField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-gray-300 text-sm mb-2 block">{label} <span className="text-red-400">*</span></label>
      <div className="flex gap-3">
        {['Ja', 'Nein'].map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium border transition ${value === opt ? opt === 'Ja' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ApplyPage({ params }: { params: Promise<{ department: string }> }) {
  const { department } = use(params);

  const [form, setForm]               = useState<DBForm | null>(null);
  const [values, setValues]           = useState<Record<string, string>>({});
  const [submitted, setSubmitted]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [isOpen, setIsOpen]           = useState<boolean | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function init() {
      const [formRes, phaseRes] = await Promise.all([
        supabase.from('department_forms').select('*').eq('department', department).single(),
        supabase.from('application_phases').select('is_open').eq('department', department).single(),
      ]);
      setForm(formRes.data);
      setIsOpen(phaseRes.data?.is_open ?? true);
      setLoading(false);
    }
    init();
  }, [department]);

  if (loading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-gray-400 text-sm">Lade...</div>
    </div>
  );

  if (!form || form.questions.length === 0) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl mb-4">🔧</p>
        <p className="text-white text-2xl font-bold mb-2">Bewerbung nicht verfügbar</p>
        <p className="text-gray-400">Diese Bewerbungsseite ist noch nicht eingerichtet.</p>
      </div>
    </div>
  );

  if (isOpen === false) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-red-500/10 border-2 border-red-500/30 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">❌</div>
        <h1 className="text-white text-2xl font-bold mb-3">Bewerbungsphase geschlossen</h1>
        <p className="text-gray-400 text-sm">Die Bewerbungsphase für das <span className="text-white font-medium">{form.title}</span> ist aktuell geschlossen.</p>
      </div>
    </div>
  );

  const colors = DEPT_COLORS[department] || DEPT_COLORS['moderation'];
  const icon   = DEPT_ICONS[department] || '📋';

  // Group questions by section
  const sections: { title: string; questions: DBQuestion[] }[] = [];
  let currentSectionTitle = '';
  for (const q of form.questions) {
    const sectionTitle = q.section || '';
    if (sectionTitle !== currentSectionTitle || sections.length === 0) {
      currentSectionTitle = sectionTitle;
      sections.push({ title: sectionTitle, questions: [q] });
    } else {
      sections[sections.length - 1].questions.push(q);
    }
  }

  function setValue(key: string, val: string) {
    setValues(p => ({ ...p, [key]: val }));
  }

  async function submit() {
    const missing = form!.questions.filter(q => q.required && !values[q.id]?.trim());
    if (missing.length > 0) {
      setError(`Bitte fülle alle Pflichtfelder aus. (${missing.length} fehlend)`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // rules_accepted check
    const rulesQ = form!.questions.find(q => q.id === 'rules_accepted' || q.label.toLowerCase().includes('regeln') || q.label.toLowerCase().includes('regelwerk'));
    if (rulesQ && values[rulesQ.id] !== 'Ja') {
      setError('Du musst mit den Regeln von Hamburg V2 einverstanden sein.');
      return;
    }

    const ageQ = form!.questions.find(q => q.type === 'number' && q.label.toLowerCase().includes('alter'));
    if (ageQ) {
      const age = parseInt(values[ageQ.id] || '0');
      if (age < 10 || age > 99) { setError('Bitte gib ein gültiges Alter ein.'); return; }
    }

    setSaving(true);
    setError('');

    const allAnswers: Record<string, string> = {};
    form!.questions.forEach(q => { if (values[q.id]) allAnswers[q.id] = values[q.id]; });

    const nameQ = form!.questions.find(q => q.label.toLowerCase().includes('vorname') || q.label.toLowerCase().includes('roblox'));
    const discordQ = form!.questions.find(q => q.label.toLowerCase().includes('discord'));
    const ageQ2 = form!.questions.find(q => q.type === 'number' && q.label.toLowerCase().includes('alter'));

    const { error: err } = await supabase.from('department_applications').insert({
      department,
      ingame_name:  (nameQ ? values[nameQ.id] : '') || '',
      discord_tag:  (discordQ ? values[discordQ.id] : '') || '',
      age:          ageQ2 ? parseInt(values[ageQ2.id] || '0') : 0,
      timezone:     'Europe/Berlin',
      availability: '',
      experience:   '',
      motivation:   '',
      extra_q1:     JSON.stringify(allAnswers).substring(0, 2000),
      extra_q2:     null,
      extra_q3:     null,
    });

    setSaving(false);
    if (err) { setError('Fehler beim Absenden. Bitte versuche es erneut.'); return; }
    setSubmitted(true);
  }

  if (submitted) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className={`w-20 h-20 ${colors.bg} ${colors.border} border-2 rounded-full flex items-center justify-center text-4xl mx-auto mb-6`}>✅</div>
        <h1 className="text-white text-2xl font-bold mb-3">Bewerbung eingegangen!</h1>
        <p className="text-gray-400 mb-2">Deine Bewerbung für das <span className={`${colors.text} font-medium`}>{form.title}</span> wurde erfolgreich eingereicht.</p>
        <p className="text-gray-500 text-sm">Wir werden uns bei dir melden. Bitte habe etwas Geduld.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1117] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className={`w-16 h-16 ${colors.bg} ${colors.border} border-2 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4`}>
            {icon}
          </div>
          <h1 className="text-white text-3xl font-bold mb-2">Hamburg V2 | {form.title} Application</h1>
          {form.intro && (
            <div className="mt-4 text-left bg-[#1a1d27] border border-white/10 rounded-xl p-5">
              {form.intro.split('\n').map((line, i) => (
                <p key={i} className={`text-gray-400 text-sm ${line === '' ? 'mt-3' : ''}`}>{line}</p>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-6">{error}</div>
        )}

        <div className="space-y-6">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 space-y-5">
              {section.title !== '' && (
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <span className={`w-7 h-7 ${colors.bg} ${colors.border} border rounded-lg flex items-center justify-center text-xs ${colors.text} font-bold flex-shrink-0`}>
                    {sIdx + 1}
                  </span>
                  {section.title}
                </h2>
              )}
              {section.questions.map(field => (
                <div key={field.id}>
                  {field.type === 'scale' ? (
                    <ScaleField label={field.label} value={values[field.id] || ''} onChange={v => setValue(field.id, v)} colors={colors} />
                  ) : field.type === 'yesno' ? (
                    <YesNoField label={field.label} value={values[field.id] || ''} onChange={v => setValue(field.id, v)} />
                  ) : field.type === 'select' ? (
                    <div>
                      <label className="text-gray-300 text-sm mb-1.5 block">{field.label} {field.required && <span className="text-red-400">*</span>}</label>
                      {field.description && <p className="text-gray-500 text-xs mb-1.5">{field.description}</p>}
                      <select value={values[field.id] || ''} onChange={e => setValue(field.id, e.target.value)}
                        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                        <option value="">Bitte auswählen...</option>
                        {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  ) : field.type === 'textarea' ? (
                    <div>
                      <label className="text-gray-300 text-sm mb-1.5 block">{field.label} {field.required && <span className="text-red-400">*</span>}</label>
                      {field.description && <p className="text-gray-500 text-xs mb-1.5">{field.description}</p>}
                      <textarea value={values[field.id] || ''} onChange={e => setValue(field.id, e.target.value)}
                        placeholder={field.placeholder} rows={4}
                        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                    </div>
                  ) : (
                    <div>
                      <label className="text-gray-300 text-sm mb-1.5 block">{field.label} {field.required && <span className="text-red-400">*</span>}</label>
                      {field.description && <p className="text-gray-500 text-xs mb-1.5">{field.description}</p>}
                      <input type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                        value={values[field.id] || ''} onChange={e => setValue(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          <button onClick={submit} disabled={saving}
            className={`w-full ${colors.button} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition text-lg`}>
            {saving ? 'Wird gesendet...' : `Bewerbung für ${form.title} einreichen`}
          </button>

          <p className="text-gray-600 text-xs text-center pb-8">
            Deine Daten werden vertraulich behandelt und nur intern verwendet. © Hamburg V2 Staff Portal
          </p>
        </div>
      </div>
    </div>
  );
}