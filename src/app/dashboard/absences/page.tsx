'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can } from '@/lib/permissions';

interface Absence {
  id: string;
  user_id: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  review_note?: string;
  created_at: string;
  profile?: { username: string; role: UserRole };
  reviewer?: { username: string };
}

export default function AbsencesPage() {
  const supabase = createClientSupabaseClient();
  const [myId, setMyId]       = useState('');
  const [myRole, setMyRole]   = useState<UserRole | null>(null);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [reason, setReason]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState<'mine' | 'all'>('mine');
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (p) setMyRole(p.role as UserRole);
    const { data } = await supabase.from('absences')
      .select('*, profile:user_id(username, role), reviewer:reviewed_by(username)')
      .order('created_at', { ascending: false });
    setAbsences(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submitAbsence() {
    if (!from || !to || !reason.trim()) { setError('Alle Felder ausfüllen.'); return; }
    if (new Date(from) > new Date(to)) { setError('Von-Datum muss vor Bis-Datum liegen.'); return; }
    setSaving(true); setError('');
    await supabase.from('absences').insert({ user_id: myId, from_date: from, to_date: to, reason: reason.trim(), status: 'pending' });
    setFrom(''); setTo(''); setReason(''); setShowNew(false);
    await load();
    setSaving(false);
  }

  async function review(id: string, status: 'approved' | 'rejected') {
    await supabase.from('absences').update({ status, reviewed_by: myId, review_note: reviewNote[id] || null }).eq('id', id);
    await load();
  }

  const STATUS_STYLE: Record<string, string> = {
    pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    approved: 'bg-green-500/10 text-green-400 border-green-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const STATUS_LABEL: Record<string, string> = { pending: '⏳ Ausstehend', approved: '✅ Genehmigt', rejected: '❌ Abgelehnt' };

  const canManage = myRole ? can.manageAbsences(myRole) : false;
  const mine = absences.filter(a => a.user_id === myId);
  const all  = absences;
  const shown = tab === 'mine' ? mine : all;

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Abmeldungen</h1>
          <p className="text-gray-500 text-sm mt-1">Urlaub & Abwesenheiten</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
          + Neue Abmeldung
        </button>
      </div>

      {showNew && (
        <div className="bg-[#13151f] border border-purple-500/20 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold">Abmeldung einreichen</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Von</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/70" />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Bis</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/70" />
            </div>
          </div>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Grund der Abmeldung..." rows={3}
            className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/70 resize-none" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="bg-white/5 hover:bg-white/10 text-gray-400 px-4 py-2 rounded-xl text-sm transition">Abbrechen</button>
            <button onClick={submitAbsence} disabled={saving} className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-xl text-sm transition">
              {saving ? 'Einreichen...' : 'Einreichen'}
            </button>
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex gap-2">
          <button onClick={() => setTab('mine')} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${tab === 'mine' ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/30 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-gray-500'}`}>Meine</button>
          <button onClick={() => setTab('all')} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${tab === 'all' ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/30 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-gray-500'}`}>Alle ({absences.filter(a => a.status === 'pending').length} offen)</button>
        </div>
      )}

      <div className="space-y-3">
        {shown.length === 0 ? (
          <div className="bg-[#13151f] border border-white/[0.06] rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-gray-500 text-sm">Keine Abmeldungen.</p>
          </div>
        ) : shown.map(a => (
          <div key={a.id} className="bg-[#13151f] border border-white/[0.06] rounded-2xl p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  {tab === 'all' && canManage && <span className="text-white font-medium text-sm">{a.profile?.username}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                </div>
                <p className="text-gray-300 text-sm">{a.reason}</p>
                <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                  <span>📅 {new Date(a.from_date).toLocaleDateString('de-DE')} – {new Date(a.to_date).toLocaleDateString('de-DE')}</span>
                  {a.reviewer && <span>• Bearbeitet von: {a.reviewer.username}</span>}
                </div>
                {a.review_note && <p className="text-gray-500 text-xs mt-1 bg-white/[0.03] rounded-lg px-3 py-2">Notiz: {a.review_note}</p>}
              </div>
            </div>
            {canManage && a.status === 'pending' && a.user_id !== myId && (
              <div className="border-t border-white/[0.05] pt-3 space-y-2">
                <input value={reviewNote[a.id] || ''} onChange={e => setReviewNote(p => ({ ...p, [a.id]: e.target.value }))}
                  placeholder="Notiz (optional)..."
                  className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-700 text-xs focus:outline-none focus:border-purple-500/50" />
                <div className="flex gap-2">
                  <button onClick={() => review(a.id, 'approved')} className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 text-xs px-4 py-1.5 rounded-lg font-medium transition">✅ Genehmigen</button>
                  <button onClick={() => review(a.id, 'rejected')} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs px-4 py-1.5 rounded-lg font-medium transition">❌ Ablehnen</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
