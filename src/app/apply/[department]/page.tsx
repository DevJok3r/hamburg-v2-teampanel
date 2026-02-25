'use client';

import { useState } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { use } from 'react';

const DEPARTMENTS: Record<string, {
  label: string;
  color: string;
  icon: string;
  questions: { key: 'extra_q1' | 'extra_q2' | 'extra_q3'; question: string; placeholder: string }[];
}> = {
  moderation: {
    label: 'Moderation Team',
    color: 'blue',
    icon: '🛡️',
    questions: [
      { key: 'extra_q1', question: 'Wie gehst du mit einem toxischen Spieler um, der andere Spieler beleidigt?', placeholder: 'Beschreibe dein Vorgehen Schritt für Schritt...' },
      { key: 'extra_q2', question: 'Hast du bereits Erfahrung als Moderator auf anderen Servern?', placeholder: 'Server, Zeitraum, Aufgaben...' },
      { key: 'extra_q3', question: 'Wie reagierst du, wenn ein Spieler eine Entscheidung von dir anficht?', placeholder: 'Deine Herangehensweise...' },
    ],
  },
  social_media: {
    label: 'Social Media Team',
    color: 'purple',
    icon: '📱',
    questions: [
      { key: 'extra_q1', question: 'Welche Social Media Plattformen kennst du und welche Erfahrungen hast du damit?', placeholder: 'Instagram, TikTok, Twitter/X, YouTube...' },
      { key: 'extra_q2', question: 'Hast du bereits Content erstellt? Wenn ja, zeig uns Beispiele oder beschreibe diese.', placeholder: 'Links, Beschreibungen, Projekte...' },
      { key: 'extra_q3', question: 'Welche Programme oder Tools nutzt du für die Content-Erstellung?', placeholder: 'Canva, Photoshop, Premiere Pro, CapCut...' },
    ],
  },
  event: {
    label: 'Event Team',
    color: 'pink',
    icon: '🎉',
    questions: [
      { key: 'extra_q1', question: 'Welche Events hast du bisher organisiert oder dabei mitgeholfen?', placeholder: 'Beschreibe die Events, deine Rolle und den Erfolg...' },
      { key: 'extra_q2', question: 'Wie gehst du vor, wenn ein Event nicht wie geplant läuft?', placeholder: 'Dein Umgang mit unerwarteten Situationen...' },
      { key: 'extra_q3', question: 'Was ist deine kreativste Event-Idee für unseren Server?', placeholder: 'Beschreibe deine Idee detailliert...' },
    ],
  },
  development: {
    label: 'Development Team',
    color: 'green',
    icon: '💻',
    questions: [
      { key: 'extra_q1', question: 'Welche Programmiersprachen und Technologien beherrschst du?', placeholder: 'Java, Python, JavaScript, Skript-Sprachen...' },
      { key: 'extra_q2', question: 'Hast du bereits Projekte entwickelt? Zeig uns Beispiele oder beschreibe diese.', placeholder: 'GitHub Links, Beschreibungen, Plugins...' },
      { key: 'extra_q3', question: 'Wie gehst du bei der Fehlersuche (Debugging) vor?', placeholder: 'Deine Methodik und Vorgehensweise...' },
    ],
  },
};

const COLOR_STYLES: Record<string, { bg: string; border: string; text: string; button: string }> = {
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   button: 'bg-blue-600 hover:bg-blue-700' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', button: 'bg-purple-600 hover:bg-purple-700' },
  pink:   { bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   text: 'text-pink-400',   button: 'bg-pink-600 hover:bg-pink-700' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  button: 'bg-green-600 hover:bg-green-700' },
};

const TIMEZONES = ['Europe/Berlin', 'Europe/London', 'Europe/Paris', 'Europe/Amsterdam', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'];

export default function ApplyPage({ params }: { params: Promise<{ department: string }> }) {
  const { department } = use(params);
  const dept = DEPARTMENTS[department];

  const [form, setForm] = useState({
    ingame_name: '', discord_tag: '', age: '', timezone: 'Europe/Berlin',
    availability: '', experience: '', motivation: '',
    extra_q1: '', extra_q2: '', extra_q3: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const supabase = createClientSupabaseClient();

  if (!dept) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-2xl font-bold mb-2">Abteilung nicht gefunden</p>
          <p className="text-gray-400">Diese Bewerbungsseite existiert nicht.</p>
        </div>
      </div>
    );
  }

  const colors = COLOR_STYLES[dept.color];

  async function submit() {
    if (!form.ingame_name.trim() || !form.discord_tag.trim() || !form.age ||
        !form.availability.trim() || !form.experience.trim() || !form.motivation.trim()) {
      setError('Bitte fülle alle Pflichtfelder aus.');
      return;
    }
    if (parseInt(form.age) < 13 || parseInt(form.age) > 99) {
      setError('Bitte gib ein gültiges Alter ein.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.from('department_applications').insert({
      department,
      ingame_name:  form.ingame_name,
      discord_tag:  form.discord_tag,
      age:          parseInt(form.age),
      timezone:     form.timezone,
      availability: form.availability,
      experience:   form.experience,
      motivation:   form.motivation,
      extra_q1:     form.extra_q1 || null,
      extra_q2:     form.extra_q2 || null,
      extra_q3:     form.extra_q3 || null,
    });
    setLoading(false);
    if (err) { setError('Fehler beim Absenden. Bitte versuche es erneut.'); return; }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className={`w-20 h-20 ${colors.bg} ${colors.border} border-2 rounded-full flex items-center justify-center text-4xl mx-auto mb-6`}>
            ✅
          </div>
          <h1 className="text-white text-2xl font-bold mb-3">Bewerbung eingegangen!</h1>
          <p className="text-gray-400 mb-2">Deine Bewerbung für das <span className={colors.text + ' font-medium'}>{dept.label}</span> wurde erfolgreich eingereicht.</p>
          <p className="text-gray-500 text-sm">Wir werden uns bei dir melden. Bitte habe etwas Geduld.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className={`w-16 h-16 ${colors.bg} ${colors.border} border-2 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4`}>
            {dept.icon}
          </div>
          <h1 className="text-white text-3xl font-bold mb-2">Bewerbung – {dept.label}</h1>
          <p className="text-gray-400">Fülle den Bewerbungsbogen vollständig und ehrlich aus.</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <p className="text-gray-500 text-sm">Hamburg V2 Staff Portal</p>
          </div>
        </div>

        <div className="space-y-6">

          {/* Allgemeine Infos */}
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <span className={`w-6 h-6 ${colors.bg} ${colors.border} border rounded-lg flex items-center justify-center text-xs ${colors.text} font-bold`}>1</span>
              Allgemeine Informationen
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Ingame Name *</label>
                <input value={form.ingame_name} onChange={e => setForm(p => ({ ...p, ingame_name: e.target.value }))}
                  placeholder="Dein Ingame Name..."
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Discord Tag *</label>
                <input value={form.discord_tag} onChange={e => setForm(p => ({ ...p, discord_tag: e.target.value }))}
                  placeholder="z.B. username#0000 oder username"
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Alter *</label>
                <input type="number" min="13" max="99" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                  placeholder="Dein Alter..."
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Zeitzone *</label>
                <select value={form.timezone} onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-1.5 block">Verfügbarkeit * <span className="text-gray-600">(Wochentage & Stunden)</span></label>
              <input value={form.availability} onChange={e => setForm(p => ({ ...p, availability: e.target.value }))}
                placeholder="z.B. Mo-Fr 17-22 Uhr, Wochenende ganztags..."
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Erfahrung & Motivation */}
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <span className={`w-6 h-6 ${colors.bg} ${colors.border} border rounded-lg flex items-center justify-center text-xs ${colors.text} font-bold`}>2</span>
              Erfahrung & Motivation
            </h2>

            <div>
              <label className="text-gray-400 text-xs mb-1.5 block">Bisherige Erfahrungen *</label>
              <textarea value={form.experience} onChange={e => setForm(p => ({ ...p, experience: e.target.value }))}
                placeholder="Beschreibe deine bisherigen Erfahrungen die für diese Stelle relevant sind..."
                rows={4}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-1.5 block">Warum bewirbst du dich? *</label>
              <textarea value={form.motivation} onChange={e => setForm(p => ({ ...p, motivation: e.target.value }))}
                placeholder="Was motiviert dich dazu, Teil unseres Teams zu werden?..."
                rows={4}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
          </div>

          {/* Abteilungsspezifische Fragen */}
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <span className={`w-6 h-6 ${colors.bg} ${colors.border} border rounded-lg flex items-center justify-center text-xs ${colors.text} font-bold`}>3</span>
              Abteilungsspezifische Fragen
            </h2>

            {dept.questions.map((q, i) => (
              <div key={q.key}>
                <label className="text-gray-400 text-xs mb-1.5 block">{i + 1}. {q.question}</label>
                <textarea value={form[q.key]} onChange={e => setForm(p => ({ ...p, [q.key]: e.target.value }))}
                  placeholder={q.placeholder} rows={3}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <button onClick={submit} disabled={loading}
            className={`w-full ${colors.button} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition text-lg`}>
            {loading ? 'Wird gesendet...' : `Bewerbung für ${dept.label} einreichen`}
          </button>

          <p className="text-gray-600 text-xs text-center">
            Deine Daten werden vertraulich behandelt und nur intern verwendet.
          </p>
        </div>
      </div>
    </div>
  );
}