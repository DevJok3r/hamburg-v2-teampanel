'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';

const CATEGORIES = [
  { key: 'teamwork',        label: 'Teamarbeit' },
  { key: 'communication',   label: 'Kommunikation' },
  { key: 'reliability',     label: 'Zuverlässigkeit' },
  { key: 'knowledge',       label: 'Fachkenntnisse' },
  { key: 'activity',        label: 'Aktivität' },
  { key: 'behavior',        label: 'Verhalten' },
  { key: 'initiative',      label: 'Initiative' },
  { key: 'rule_compliance', label: 'Regeleinhaltung' },
  { key: 'stress',          label: 'Stressresistenz' },
  { key: 'improvement',     label: 'Verbesserungsbereitschaft' },
];

const GRADE_LABELS: Record<number, string> = {
  1: 'Sehr gut', 2: 'Gut', 3: 'Befriedigend',
  4: 'Ausreichend', 5: 'Mangelhaft', 6: 'Ungenügend',
};
const GRADE_COLORS: Record<number, string> = {
  1: 'text-green-400', 2: 'text-green-300', 3: 'text-yellow-400',
  4: 'text-orange-400', 5: 'text-red-400', 6: 'text-red-600',
};

export default function MyEvaluationsPage() {
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<any | null>(null);
  const supabase = createClientSupabaseClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('evaluations')
        .select('*, profiles!evaluations_evaluator_id_fkey(username, role)')
        .eq('evaluated_user_id', user.id)
        .eq('status', 'final')
        .order('created_at', { ascending: false });
      setEvaluations(data || []);
      setLoading(false);
    }
    load();
  }, []);

  function avg(scores: Record<string, number>) {
    const vals = Object.values(scores).filter(Boolean);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '–';
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Meine Leistungsbewertungen</h1>
        <p className="text-gray-400 text-sm mt-1">{evaluations.length} abgeschlossene Bewertungen</p>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">Leistungsbewertung</h2>
                <p className="text-gray-400 text-xs mt-0.5">
                  Bewertet von <span className="text-blue-400">{selected.profiles?.username}</span> · {new Date(selected.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-[#0f1117] rounded-xl p-4 text-center mb-2">
                <p className="text-gray-400 text-xs mb-1">Gesamtdurchschnitt</p>
                <p className={`text-4xl font-bold ${GRADE_COLORS[Math.round(Number(avg(selected.scores)))] || 'text-white'}`}>
                  {avg(selected.scores)}
                </p>
              </div>
              {CATEGORIES.map(cat => {
                const score = selected.scores?.[cat.key];
                if (!score) return null;
                return (
                  <div key={cat.key} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-3">
                    <span className="text-gray-300 text-sm">{cat.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${GRADE_COLORS[score]}`}>{score}</span>
                      <span className={`text-xs ${GRADE_COLORS[score]}`}>{GRADE_LABELS[score]}</span>
                    </div>
                  </div>
                );
              })}
              {selected.notes && (
                <div className="bg-[#0f1117] rounded-lg p-4 mt-2">
                  <p className="text-gray-500 text-xs mb-1">Anmerkungen</p>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{selected.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {evaluations.length === 0 ? (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-white font-medium mb-1">Noch keine Bewertungen</p>
          <p className="text-gray-500 text-sm">Abgeschlossene Leistungsbewertungen werden hier angezeigt.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map(ev => (
            <div key={ev.id} onClick={() => setSelected(ev)}
              className="bg-[#1a1d27] border border-white/10 hover:border-blue-500/30 rounded-xl p-5 cursor-pointer transition">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">
                    Bewertet von <span className="text-white font-medium">{ev.profiles?.username}</span>
                  </p>
                  <p className="text-gray-500 text-xs">{new Date(ev.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-gray-400 text-xs mb-1">Durchschnitt</p>
                  <p className={`text-2xl font-bold ${GRADE_COLORS[Math.round(Number(avg(ev.scores)))] || 'text-white'}`}>
                    {avg(ev.scores)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1.5 mt-3">
                {CATEGORIES.map(cat => {
                  const score = ev.scores?.[cat.key];
                  if (!score) return null;
                  return (
                    <div key={cat.key} className="bg-[#0f1117] rounded-lg p-1.5 text-center">
                      <p className={`text-xs font-bold ${GRADE_COLORS[score]}`}>{score}</p>
                      <p className="text-gray-600 text-xs leading-tight mt-0.5 truncate">{cat.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}