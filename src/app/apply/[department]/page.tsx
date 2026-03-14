'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { use } from 'react';

type FieldType = 'text' | 'textarea' | 'number' | 'scale' | 'yesno' | 'select' | 'email';
interface Field { key: string; label: string; description?: string; type: FieldType; required?: boolean; options?: string[]; placeholder?: string; }
interface Section { title?: string; fields: Field[]; }
interface DeptConfig { label: string; color: string; icon: string; intro: string; sections: Section[]; }

const DEPARTMENTS: Record<string, DeptConfig> = {
  social_media: {
    label: 'Social Media Team', color: 'purple', icon: '📱',
    intro: 'Herzlich willkommen zur Social Media Team Application für Hamburg V2! Wir bedanken uns für dein Interesse an unserem Social Media Team.\n\nBitte beantworte die Fragen ehrlich und ausführlich. Spaß- oder Trollantworten werden ignoriert und direkt entfernt. Solltest du innerhalb von 7 Tagen keine Rückmeldung von der Fachbereichsleitung Social Media erhalten, gehe bitte davon aus, dass deine Bewerbung abgelehnt wurde.\n\nAchte außerdem darauf, dass deine Discord-Direktnachrichten auf öffentlich gestellt sind, damit wir dich erreichen können. Nur angenommene Bewerber werden zu einem Bewerbungsgespräch eingeladen.\n\nWir wünschen dir viel Erfolg bei deiner Bewerbung!',
    sections: [
      { title: 'Persönliche Informationen', fields: [
        { key: 'roblox_name',  label: 'Roblox Name',  type: 'text',   required: true, placeholder: 'Dein Roblox Benutzername...' },
        { key: 'discord_name', label: 'Discord Name', type: 'text',   required: true, placeholder: 'z.B. username oder username#0000' },
        { key: 'age',          label: 'Alter',         type: 'number', required: true, placeholder: 'Dein Alter...' },
      ]},
      { title: 'Hamburg Social Media Team Application', fields: [
        { key: 'scale_grammar',  label: 'Ich kann mich mit korrekter Rechtschreibung & Grammatik ausdrücken', type: 'scale', required: true },
        { key: 'scale_time',     label: 'Ich habe genug Zeit um aktiv Content zu erstellen', type: 'scale', required: true },
        { key: 'motivation',     label: 'Warum möchtest du Teil des Social Media Teams bei Hamburg V2 werden?', type: 'textarea', required: true, placeholder: 'Beschreibe deine Motivation ausführlich...' },
        { key: 'has_experience', label: 'Hast du bereits Erfahrung im Bereich Social Media?', type: 'yesno', required: true },
        { key: 'tools',          label: 'Mit welchen Programmen oder Tools arbeitest du?', description: 'z.B. Photoshop, Canva, Premiere, CapCut', type: 'textarea', required: true, placeholder: 'Liste alle Programme auf die du beherrschst...' },
        { key: 'strengths',      label: 'Welche Stärken bringst du mit, die dich für das Social Media Team qualifizieren?', type: 'textarea', required: true, placeholder: 'Deine Stärken und Qualifikationen...' },
      ]},
      { title: 'Aktivität & Verfügbarkeit', fields: [
        { key: 'hours_per_week', label: 'Wie viel Zeit pro Woche kannst du ins Social Media Team investieren?', type: 'text', required: true, placeholder: 'z.B. 10-15 Stunden pro Woche...' },
        { key: 'active_times',   label: 'Zu welchen Tageszeiten bist du meistens aktiv?', type: 'text', required: true, placeholder: 'z.B. Abends 18-22 Uhr, Wochenende tagsüber...' },
      ]},
      { title: 'Abschlussfragen', fields: [
        { key: 'portfolio',      label: 'Möchtest du uns Beispiele deiner bisherigen Arbeiten zeigen?', description: 'workupload.com Link (Optional)', type: 'text', required: false, placeholder: 'Link zu deinen Arbeiten (optional)...' },
        { key: 'rules_accepted', label: 'Bist du mit den Regeln von Hamburg V2 einverstanden und bereit, diese einzuhalten?', type: 'yesno', required: true },
        { key: 'extra_info',     label: 'Möchtest du uns noch etwas mitteilen?', type: 'textarea', required: false, placeholder: 'Weitere Informationen (optional)...' },
      ]},
    ],
  },
  event: {
    label: 'Event Team', color: 'pink', icon: '🎉',
    intro: 'Sehr geehrte Community,\n\ndas Hamburger Event Team sucht erneut nach Verstärkung!\n\n• Planung und Veranstaltung von Trainings\n• Rangverwaltung der User\n• Zusammen bei gemeinsamen Trainings und Events mitwirken\n\nWir freuen uns auf deine Bewerbung!',
    sections: [
      { title: 'Persönliche Informationen', fields: [
        { key: 'first_name',   label: 'Name',         type: 'text', required: true, placeholder: 'Dein Vorname...' },
        { key: 'roblox_name',  label: 'Roblox Name',  type: 'text', required: true, placeholder: 'Dein Roblox Benutzername...' },
        { key: 'discord_name', label: 'Discord Name', type: 'text', required: true, placeholder: 'Dein Discord Benutzername...' },
      ]},
      { title: 'Team-Auswahl', fields: [
        { key: 'training_team',   label: 'Welches Team möchtest du trainieren?', type: 'select', required: true, options: ['Landeskriminalamt', 'Landespolizei', 'Rettungsdienst', 'Berufsfeuerwehr', 'Anwaltskanzlei', 'Amtsgericht'] },
        { key: 'team_knowledge',  label: 'Was weißt du über das gewählte Team und seine Aufgaben?', type: 'textarea', required: true, placeholder: 'Beschreibe dein Wissen über das gewählte Team...' },
        { key: 'team_experience', label: 'Hast du selbst Erfahrung in dem gewählten Team?', type: 'textarea', required: true, placeholder: 'Deine eigene Erfahrung im gewählten Bereich...' },
      ]},
      { title: 'Allgemeine Informationen', fields: [
        { key: 'discord_id',       label: 'Wie lautet deine Discord-ID?', type: 'text', required: true, placeholder: 'z.B. 123456789012345678...' },
        { key: 'training_concept', label: 'Wie würdest du dein eigenes Training gestalten?', type: 'textarea', required: true, placeholder: 'Beschreibe deinen Trainingsablauf detailliert...' },
        { key: 'good_trainer',     label: 'Was macht deiner Meinung nach ein guter Event Organizer & ein gutes Training aus?', type: 'textarea', required: true, placeholder: 'Deine Vorstellung von einem guten Training...' },
        { key: 'age',              label: 'Wie alt bist du?', type: 'number', required: true, placeholder: 'Dein Alter...' },
        { key: 'motivation',       label: 'Warum denkst du bist du perfekt für uns geeignet?', type: 'textarea', required: true, placeholder: 'Deine Stärken und Qualifikationen...' },
        { key: 'has_microphone',   label: 'Hast du ein funktionierendes Mikrofon?', type: 'yesno', required: true },
      ]},
      { title: 'Aktivität & Verfügbarkeit', fields: [
        { key: 'hours_per_week', label: 'Wie viele Stunden pro Woche kannst du aktiv im Event Team mithelfen?', type: 'text', required: true, placeholder: 'z.B. 5-10 Stunden...' },
        { key: 'active_times',   label: 'Zu welchen Tageszeiten bist du meistens aktiv?', type: 'text', required: true, placeholder: 'z.B. Abends 18-22 Uhr...' },
      ]},
      { title: 'Abschlussfragen', fields: [
        { key: 'rules_accepted', label: 'Bist du mit den Regeln von Hamburg V2 einverstanden und bereit, diese einzuhalten?', type: 'yesno', required: true },
        { key: 'extra_info',     label: 'Möchtest du uns noch etwas mitteilen?', type: 'textarea', required: false, placeholder: 'Weitere Informationen (optional)...' },
      ]},
    ],
  },
  moderation: {
    label: 'Moderation Team', color: 'blue', icon: '🛡️',
    intro: 'Herzlich willkommen zur Moderation Team Application für Hamburg V2!\n\nZunächst möchten wir ein paar Dinge klarstellen:\n\n1. Beantworte die Fragen ehrlich und ausführlich. Alles andere führt zur Ablehnung.\n2. Solltest du innerhalb 4 Tage keine Rückmeldung von unserem Moderation Team Lead bekommen haben, wurde deine Bewerbung abgelehnt.\n3. Bitte beachte, dass deine Discord Direktnachrichten auf "öffentlich" gestellt sind, damit wir dich auch kontaktieren können!\n4. Nur Personen, die eine positive Rückmeldung bekommen haben werden zu einem Bewerbungsgespräch eingeladen.\n\nWir wünschen dir viel Erfolg!',
    sections: [
      { title: 'Persönliche Informationen', fields: [
        { key: 'first_name',           label: 'Wie lautet dein Vorname?',   type: 'text',   required: true, placeholder: 'Dein Vorname...' },
        { key: 'discord_name',         label: 'Wie heißt du auf Discord?',  type: 'text',   required: true, placeholder: 'Dein Discord Name...' },
        { key: 'roblox_name',          label: 'Wie heißt du auf Roblox?',   type: 'text',   required: true, placeholder: 'Dein Roblox Name...' },
        { key: 'age',                  label: 'Wie alt bist du?',            type: 'number', required: true, placeholder: 'Dein Alter...' },
        { key: 'strengths_weaknesses', label: 'Was sind deine Stärken & Schwächen?', type: 'textarea', required: true, placeholder: 'Beschreibe deine Stärken und Schwächen ehrlich...' },
        { key: 'motivation',           label: 'Warum möchtest du in unser Moderation Team?', type: 'textarea', required: true, placeholder: 'Deine Motivation ausführlich beschreiben...' },
        { key: 'why_you',              label: 'Warum sollten wir genau dich nehmen & was unterscheidet dich von anderen?', type: 'textarea', required: true, placeholder: 'Was macht dich besonders...' },
      ]},
      { title: 'Erfahrung & Verfügbarkeit', fields: [
        { key: 'has_experience', label: 'Hast du bereits Erfahrung als Moderator in anderen Projekten?', type: 'yesno', required: true },
        { key: 'three_words',    label: 'Beschreibe dich selbst in 3 Worten', type: 'text', required: true, placeholder: 'z.B. zuverlässig, ruhig, gerecht...' },
        { key: 'hours_per_day',  label: 'Wie viele Stunden pro Tag kannst du für unsere Moderation aufwenden?', type: 'text', required: true, placeholder: 'z.B. 2-3 Stunden täglich...' },
        { key: 'active_times',   label: 'Um welche Tageszeiten bist du am häufigsten aktiv?', type: 'text', required: true, placeholder: 'z.B. 16-22 Uhr...' },
      ]},
      { title: 'Wissen zu Situationsfragen', fields: [
        { key: 'situation_1', label: 'Ein Spieler wird sehr ausfallend im Roblox Ingame Chat sowie Ingame Voice Chat. Wie gehst du vor?', type: 'textarea', required: true, placeholder: 'Beschreibe dein genaues Vorgehen Schritt für Schritt...' },
        { key: 'situation_2', label: 'Ein Spieler betreibt mehrere Regelverstöße (Ingame) aufeinmal. Wie würdest du handeln?', type: 'textarea', required: true, placeholder: 'Deine Vorgehensweise bei mehrfachen Verstößen...' },
        { key: 'situation_3', label: 'Dein Freund betreibt auf Discord sowie Ingame mehrere Regelverstöße. Wie ist dein Vorgehen?', type: 'textarea', required: true, placeholder: 'Wie gehst du vor wenn ein Freund gegen Regeln verstößt...' },
        { key: 'situation_4', label: 'Wie gehst du mit Spielern um, die sich im Chat streiten?', type: 'textarea', required: true, placeholder: 'Deine Deeskalationsstrategie...' },
        { key: 'situation_5', label: 'Du hast gerade einen Spieler auf Discord verwarnt. Er eröffnet ein Team-Report Ticket. Wie würdest du den Warn als gerechtfertigt argumentieren?', type: 'textarea', required: true, placeholder: 'Deine Argumentation im Report Ticket...' },
      ]},
      { title: 'Abschluss', fields: [
        { key: 'rules_accepted', label: 'Bist du mit dem offiziellen Regelwerk von Hamburg V2 einverstanden?', type: 'yesno', required: true },
        { key: 'extra_info',     label: 'Gibt es noch etwas, das du uns mitteilen möchtest?', type: 'textarea', required: false, placeholder: 'Weitere Informationen (optional)...' },
      ]},
    ],
  },
  development: {
    label: 'Development Team', color: 'green', icon: '💻',
    intro: 'Herzlich willkommen in der Development Team Application für Hamburg V2!\n\nWir freuen uns sehr, dass du Interesse hast, unser Development Team zu unterstützen.\n\nBitte beachte vor dem Ausfüllen:\n• Antworte auf alle Fragen sachlich & ehrlich.\n• Solltest du innerhalb von 7 Tagen keine Rückmeldung erhalten, gilt die Bewerbung als abgelehnt.\n• Stelle sicher, dass deine Discord-DMs öffentlich sind.\n• Nur angenommene Bewerber werden zu einem Gespräch eingeladen.\n\nViel Erfolg! 🚀',
    sections: [
      { title: 'Persönliche Informationen', fields: [
        { key: 'first_name',   label: 'Vorname',   type: 'text',   required: true, placeholder: 'Dein Vorname...' },
        { key: 'age',          label: 'Alter',      type: 'number', required: true, placeholder: 'Dein Alter...' },
        { key: 'roblox_name',  label: 'Roblox Name',               type: 'text', required: true, placeholder: 'Dein Roblox Benutzername...' },
        { key: 'discord_name', label: 'Discord Name & Discord ID', type: 'text', required: true, placeholder: 'z.B. username | 123456789012345678...' },
      ]},
      { title: 'Eignung & Erfahrung', fields: [
        { key: 'why_you',        label: 'Warum denkst du, bist du perfekt für die Rolle eines Developers geeignet?', type: 'textarea', required: true, placeholder: 'Deine Stärken und was dich qualifiziert...' },
        { key: 'dev_experience', label: 'Hast du bereits Erfahrungen im Development?', type: 'textarea', required: true, placeholder: 'Beschreibe deine Erfahrungen ausführlich...' },
        { key: 'dev_area',       label: 'Für welchen Bereich möchtest du dich bewerben?', type: 'select', required: true, options: ['Scripting', 'Building', 'Modelling', 'Andere'] },
      ]},
      { title: 'Technische Kenntnisse', fields: [
        { key: 'roblox_studio', label: 'Hast du bereits Erfahrung mit Roblox Studio?', type: 'yesno', required: true },
        { key: 'years_active',  label: 'Seit wie vielen Jahren bzw. Monaten bist du im Development tätig?', type: 'text', required: true, placeholder: 'z.B. 2 Jahre, 6 Monate...' },
        { key: 'portfolio',     label: 'Bitte gib uns vorherige Projekte (Scripts, Buildings etc.) als Link', description: 'workupload.com Link (im .png-Format)', type: 'text', required: false, placeholder: 'Link zu deinen Projekten...' },
      ]},
      { title: 'Soft Skills & Teamarbeit', fields: [
        { key: 'handle_criticism', label: 'Wie gehst du mit Kritik an deiner Arbeit um?', type: 'textarea', required: true, placeholder: 'Dein Umgang mit Feedback und Kritik...' },
        { key: 'alone_or_team',    label: 'Arbeitest du lieber alleine oder im Team?', type: 'textarea', required: true, placeholder: 'Begründe deine Präferenz...' },
        { key: 'disagreement',     label: 'Ein Teammitglied hat eine andere Lösungsidee als du – wie würdest du reagieren?', type: 'textarea', required: true, placeholder: 'Deine Reaktion bei unterschiedlichen Meinungen...' },
      ]},
      { title: 'Abschluss', fields: [
        { key: 'extra_info',      label: 'Gibt es noch etwas, das du uns mitteilen möchtest?', type: 'textarea', required: false, placeholder: 'Weitere Informationen (optional)...' },
        { key: 'time_motivation', label: 'Bist du dir sicher, dass du die Zeit & Motivation hast, aktiv im Development Team mitzuarbeiten?', type: 'yesno', required: true },
      ]},
    ],
  },
};

const COLOR_STYLES: Record<string, { bg: string; border: string; text: string; button: string; scale_active: string }> = {
  blue:   { bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   button: 'bg-blue-600 hover:bg-blue-700',    scale_active: 'bg-blue-600 text-white border-blue-500' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', button: 'bg-purple-600 hover:bg-purple-700', scale_active: 'bg-purple-600 text-white border-purple-500' },
  pink:   { bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   text: 'text-pink-400',   button: 'bg-pink-600 hover:bg-pink-700',    scale_active: 'bg-pink-600 text-white border-pink-500' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  button: 'bg-green-600 hover:bg-green-700',  scale_active: 'bg-green-600 text-white border-green-500' },
};

function formToDb(department: string, values: Record<string, string>) {
  const dept = DEPARTMENTS[department];
  const allFields: Field[] = dept.sections.flatMap(s => s.fields);
  const questionAnswers: Record<string, string> = {};
  allFields.forEach(f => { if (values[f.key] !== undefined) questionAnswers[f.key] = values[f.key]; });
  return {
    department,
    ingame_name:  values['roblox_name'] || values['first_name'] || '',
    discord_tag:  values['discord_name'] || '',
    age:          parseInt(values['age'] || '0') || 0,
    timezone:     'Europe/Berlin',
    availability: values['hours_per_week'] || values['hours_per_day'] || '',
    experience:   values['dev_experience'] || values['has_experience'] || '',
    motivation:   values['motivation'] || values['why_you'] || '',
    extra_q1:     JSON.stringify(questionAnswers).substring(0, 2000),
    extra_q2:     null, extra_q3: null,
  };
}

function ScaleField({ label, value, onChange, colors }: { label: string; value: string; onChange: (v: string) => void; colors: typeof COLOR_STYLES[string] }) {
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
  const dept = DEPARTMENTS[department];

  const [values, setValues]             = useState<Record<string, string>>({});
  const [submitted, setSubmitted]       = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [isOpen, setIsOpen]             = useState<boolean | null>(null);
  const [phaseLoading, setPhaseLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function checkPhase() {
      const { data } = await supabase
        .from('application_phases')
        .select('is_open')
        .eq('department', department)
        .single();
      setIsOpen(data?.is_open ?? true);
      setPhaseLoading(false);
    }
    checkPhase();
  }, [department]);

  if (phaseLoading) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-gray-400 text-sm">Lade...</div>
    </div>
  );

  if (!dept) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="text-center">
        <p className="text-white text-2xl font-bold mb-2">Abteilung nicht gefunden</p>
        <p className="text-gray-400">Diese Bewerbungsseite existiert nicht.</p>
      </div>
    </div>
  );

  if (isOpen === false) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-red-500/10 border-2 border-red-500/30 rounded-full flex items-center justify-center text-5xl mx-auto mb-6">❌</div>
        <h1 className="text-white text-2xl font-bold mb-3">Bewerbungsphase geschlossen</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Die Bewerbungsphase für das <span className="text-white font-medium">{dept.label}</span> ist aktuell geschlossen.
        </p>
        <p className="text-gray-500 text-xs mt-3">Bitte schaue zu einem späteren Zeitpunkt wieder vorbei.</p>
      </div>
    </div>
  );

  const colors    = COLOR_STYLES[dept.color];
  const allFields = dept.sections.flatMap(s => s.fields);

  function setValue(key: string, val: string) { setValues(p => ({ ...p, [key]: val })); }

  async function submit() {
    const missing = allFields.filter(f => f.required && !values[f.key]?.trim());
    if (missing.length > 0) { setError(`Bitte fülle alle Pflichtfelder aus. (${missing.length} fehlend)`); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const age = parseInt(values['age'] || '0');
    if (age < 10 || age > 99) { setError('Bitte gib ein gültiges Alter ein.'); return; }
    if (values['rules_accepted'] !== 'Ja') { setError('Du musst mit den Regeln von Hamburg V2 einverstanden sein.'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.from('department_applications').insert(formToDb(department, values));
    setLoading(false);
    if (err) { setError('Fehler beim Absenden. Bitte versuche es erneut.'); return; }
    setSubmitted(true);
  }

  if (submitted) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className={`w-20 h-20 ${colors.bg} ${colors.border} border-2 rounded-full flex items-center justify-center text-4xl mx-auto mb-6`}>✅</div>
        <h1 className="text-white text-2xl font-bold mb-3">Bewerbung eingegangen!</h1>
        <p className="text-gray-400 mb-2">Deine Bewerbung für das <span className={`${colors.text} font-medium`}>{dept.label}</span> wurde erfolgreich eingereicht.</p>
        <p className="text-gray-500 text-sm">Wir werden uns bei dir melden. Bitte habe etwas Geduld.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f1117] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className={`w-16 h-16 ${colors.bg} ${colors.border} border-2 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4`}>{dept.icon}</div>
          <h1 className="text-white text-3xl font-bold mb-2">Hamburg V2 | {dept.label} Application</h1>
          <div className="mt-4 text-left bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            {dept.intro.split('\n').map((line, i) => (
              <p key={i} className={`text-gray-400 text-sm ${line === '' ? 'mt-3' : ''}`}>{line}</p>
            ))}
          </div>
        </div>
        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-6">{error}</div>}
        <div className="space-y-6">
          {dept.sections.map((section, sIdx) => (
            <div key={sIdx} className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 space-y-5">
              {section.title && (
                <h2 className="text-white font-bold text-lg flex items-center gap-2">
                  <span className={`w-7 h-7 ${colors.bg} ${colors.border} border rounded-lg flex items-center justify-center text-xs ${colors.text} font-bold flex-shrink-0`}>{sIdx + 1}</span>
                  {section.title}
                </h2>
              )}
              {section.fields.map(field => (
                <div key={field.key}>
                  {field.type === 'scale' ? (
                    <ScaleField label={field.label} value={values[field.key] || ''} onChange={v => setValue(field.key, v)} colors={colors} />
                  ) : field.type === 'yesno' ? (
                    <YesNoField label={field.label} value={values[field.key] || ''} onChange={v => setValue(field.key, v)} />
                  ) : field.type === 'select' ? (
                    <div>
                      <label className="text-gray-300 text-sm mb-1.5 block">{field.label} {field.required && <span className="text-red-400">*</span>}</label>
                      {field.description && <p className="text-gray-500 text-xs mb-1.5">{field.description}</p>}
                      <select value={values[field.key] || ''} onChange={e => setValue(field.key, e.target.value)}
                        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                        <option value="">Bitte auswählen...</option>
                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                  ) : field.type === 'textarea' ? (
                    <div>
                      <label className="text-gray-300 text-sm mb-1.5 block">{field.label} {field.required && <span className="text-red-400">*</span>}</label>
                      {field.description && <p className="text-gray-500 text-xs mb-1.5">{field.description}</p>}
                      <textarea value={values[field.key] || ''} onChange={e => setValue(field.key, e.target.value)}
                        placeholder={field.placeholder} rows={4}
                        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                    </div>
                  ) : (
                    <div>
                      <label className="text-gray-300 text-sm mb-1.5 block">{field.label} {field.required && <span className="text-red-400">*</span>}</label>
                      {field.description && <p className="text-gray-500 text-xs mb-1.5">{field.description}</p>}
                      <input type={field.type === 'number' ? 'number' : 'text'}
                        value={values[field.key] || ''} onChange={e => setValue(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          <button onClick={submit} disabled={loading}
            className={`w-full ${colors.button} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition text-lg`}>
            {loading ? 'Wird gesendet...' : `Bewerbung für ${dept.label} einreichen`}
          </button>
          <p className="text-gray-600 text-xs text-center pb-8">Deine Daten werden vertraulich behandelt und nur intern verwendet. © Hamburg V2 Staff Portal</p>
        </div>
      </div>
    </div>
  );
}