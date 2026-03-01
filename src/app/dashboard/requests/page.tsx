'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';

const CATEGORIES = [
  { key: 'pruefung',        label: 'Prüfungsanordnung',    icon: '📋', description: 'Prüfung für einen Kandidaten anordnen',         requiresCandidate: true  },
  { key: 'befoerderung',    label: 'Beförderungsantrag',   icon: '⬆️', description: 'Beförderung eines Teammitglieds beantragen',    requiresCandidate: true  },
  { key: 'abmahnung',       label: 'Abmahnungsantrag',     icon: '⚠️', description: 'Offizielle Abmahnung für ein Teammitglied',     requiresCandidate: true  },
  { key: 'entlassung',      label: 'Entlassungsantrag',    icon: '🚫', description: 'Entlassung eines Teammitglieds beantragen',     requiresCandidate: true  },
  { key: 'urlaub',          label: 'Urlaubsantrag',        icon: '🏖️', description: 'Urlaub oder längere Inaktivität beantragen',    requiresCandidate: false },
  { key: 'regelaenderung',  label: 'Regeländerungsantrag', icon: '📜', description: 'Änderung einer bestehenden Regel beantragen',   requiresCandidate: false },
  { key: 'ressource',       label: 'Ressourcenanfrage',    icon: '🔧', description: 'Tools, Zugänge oder Ressourcen anfragen',       requiresCandidate: false },
  { key: 'sonstiges',       label: 'Sonstiges',            icon: '📝', description: 'Allgemeiner Antrag oder Anfrage',               requiresCandidate: false },
];

const PRIORITIES = [
  { key: 'low',    label: 'Niedrig',  color: 'text-gray-400 bg-gray-500/10 border-gray-500/30' },
  { key: 'normal', label: 'Normal',   color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { key: 'high',   label: 'Hoch',     color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  { key: 'urgent', label: 'Dringend', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
];

const STATUS_CONFIG = {
  pending:  { label: 'Ausstehend',  color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', icon: '⏳' },
  approved: { label: 'Genehmigt',   color: 'text-green-400 bg-green-500/10 border-green-500/30',   icon: '✅' },
  rejected: { label: 'Abgelehnt',   color: 'text-red-400 bg-red-500/10 border-red-500/30',         icon: '❌' },
  review:   { label: 'In Prüfung',  color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', icon: '🔍' },
};

const ROLE_LEVEL: Record<string, number> = {
  top_management: 100, management: 80, junior_management: 80,
  senior_moderator: 40, senior_developer: 40, senior_content: 40, senior_event: 40,
  moderator: 20, developer: 20, content_producer: 20, event_organizer: 20,
  trial_moderator: 10, trial_developer: 10, trial_content: 10, trial_event: 10,
};

type TabType = 'all' | 'mine' | 'pending';

export default function RequestsPage() {
  const [myId, setMyId]       = useState('');
  const [myRole, setMyRole]   = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<TabType>('all');
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  // Form
  const [fCategory, setFCategory]   = useState('pruefung');
  const [fTitle, setFTitle]         = useState('');
  const [fDesc, setFDesc]           = useState('');
  const [fPriority, setFPriority]   = useState('normal');
  const [fCandidate, setFCandidate] = useState('');
  const [fExam, setFExam]           = useState('');
  const [exams, setExams]           = useState<any[]>([]);
  const [saving, setSaving]         = useState(false);

  // Review
  const [reviewResponse, setReviewResponse] = useState('');

  const supabase = createClientSupabaseClient();

  function showMsg(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (p) setMyRole(p.role || '');
    const { data: m } = await supabase.from('profiles').select('id, username, role').eq('is_active', true).order('username');
    setMembers(m || []);
    const { data: e } = await supabase.from('exams').select('id, title').order('title');
    setExams(e || []);
    await loadRequests();
    setLoading(false);
  }

  async function loadRequests() {
    const { data } = await supabase.from('requests')
      .select('*, requester:requested_by(username, role), candidate:assigned_to(username, role), reviewer:reviewed_by(username)')
      .order('created_at', { ascending: false });
    setRequests(data || []);
  }

  useEffect(() => { load(); }, []);

  const roleLevel = ROLE_LEVEL[myRole] || 0;
  const isManager = roleLevel >= 80;
  const isTopMgmt = myRole === 'top_management';

  const selectedCategory = CATEGORIES.find(c => c.key === fCategory);

  async function submitRequest() {
    if (!fTitle.trim() || !fCategory) return;
    setSaving(true);
    const metadata: any = {};
    if (fExam) metadata.exam_id = fExam;

    const { error } = await supabase.from('requests').insert({
      category: fCategory,
      title: fTitle,
      description: fDesc || null,
      priority: fPriority,
      requested_by: myId,
      assigned_to: fCandidate || null,
      metadata,
    });

    if (error) { showMsg('❌ ' + error.message, false); }
    else {
      showMsg('✅ Antrag gestellt!');
      setShowCreate(false);
      setFTitle(''); setFDesc(''); setFCandidate(''); setFExam(''); setFPriority('normal');
      await loadRequests();
    }
    setSaving(false);
  }

  async function reviewRequest(id: string, status: 'approved' | 'rejected' | 'review') {
    setSaving(true);
    const req = requests.find(r => r.id === id);

    if (status === 'approved' && req?.category === 'pruefung' && req?.metadata?.exam_id) {
      const { data: session } = await supabase.from('exam_sessions').insert({
        exam_id: req.metadata.exam_id,
        candidate_id: req.assigned_to,
        examiner_id: req.requested_by,
      }).select().single();
      if (session) {
        const link = `${window.location.origin}/pruefung/${(session as any).token}`;
        await navigator.clipboard.writeText(link);
        showMsg('✅ Genehmigt! Prüfungslink kopiert.');
      }
    } else if (status === 'approved') {
      showMsg('✅ Antrag genehmigt!');
    } else if (status === 'rejected') {
      showMsg('❌ Antrag abgelehnt.');
    } else {
      showMsg('🔍 In Prüfung gesetzt.');
    }

    await supabase.from('requests').update({
      status,
      response: reviewResponse || null,
      reviewed_by: myId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id);

    setSelectedRequest(null);
    setReviewResponse('');
    await loadRequests();
    setSaving(false);
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  const filteredRequests = requests.filter(r => {
    if (tab === 'mine')    return r.requested_by === myId;
    if (tab === 'pending') return r.status === 'pending';
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const myCount      = requests.filter(r => r.requested_by === myId).length;

  return (
    <div className="max-w-4xl space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Anträge</h1>
          <p className="text-gray-400 text-sm mt-1">Prüfungen · Beförderungen · Regeländerungen & mehr</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Neuer Antrag
        </button>
      </div>

      {msg && <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>{msg.text}</div>}

      {/* TABS */}
      <div className="flex gap-1 bg-[#1a1d27] border border-white/10 rounded-xl p-1">
        {([
          { key: 'all',     label: 'Alle',         count: requests.length },
          { key: 'mine',    label: 'Meine Anträge', count: myCount },
          { key: 'pending', label: 'Ausstehend',    count: pendingCount },
        ] as { key: TabType; label: string; count: number }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* REQUEST LIST */}
      <div className="space-y-3">
        {filteredRequests.length === 0 && (
          <div className="text-center py-12 bg-[#1a1d27] border border-white/10 rounded-xl">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400 text-sm">Keine Anträge vorhanden</p>
          </div>
        )}
        {filteredRequests.map(r => {
          const cat      = CATEGORIES.find(c => c.key === r.category);
          const prio     = PRIORITIES.find(p => p.key === r.priority);
          const statusCf = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
          const isOwn    = r.requested_by === myId;
          const canReview = isManager && !isOwn;

          return (
            <div key={r.id} onClick={() => setSelectedRequest(r)}
              className="bg-[#1a1d27] border border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{cat?.icon || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-gray-400 text-xs">{cat?.label}</span>
                      {prio && <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${prio.color}`}>{prio.label}</span>}
                    </div>
                    <h3 className="text-white font-semibold truncate">{r.title}</h3>
                    {r.description && <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{r.description}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-gray-500 text-xs">Von: <span className="text-purple-400">{r.requester?.username}</span></span>
                      {r.candidate && <span className="text-gray-500 text-xs">Betrifft: <span className="text-blue-400">{r.candidate?.username}</span></span>}
                      <span className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleDateString('de-DE')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded border font-medium ${statusCf.color}`}>
                    {statusCf.icon} {statusCf.label}
                  </span>
                  {canReview && r.status === 'pending' && (
                    <span className="text-xs text-blue-400">Klicken zum Bearbeiten →</span>
                  )}
                  {isOwn && <span className="text-xs text-gray-600">Mein Antrag</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Neuer Antrag</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white transition">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Kategorie */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Kategorie</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c.key} onClick={() => setFCategory(c.key)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition ${fCategory === c.key ? 'bg-blue-500/20 border-blue-500/50 text-white' : 'bg-[#0f1117] border-white/10 text-gray-400 hover:bg-white/5 hover:border-white/20'}`}>
                      <span>{c.icon}</span>
                      <span className="text-xs font-medium">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedCategory && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                  <p className="text-blue-300 text-xs">{selectedCategory.description}</p>
                </div>
              )}

              {/* Titel */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Titel</label>
                <input value={fTitle} onChange={e => setFTitle(e.target.value)}
                  placeholder="Kurze Beschreibung des Antrags..."
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
              </div>

              {/* Beschreibung */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Begründung / Details</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)}
                  placeholder="Warum wird dieser Antrag gestellt? Alle relevanten Details..." rows={3}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>

              {/* Kandidat */}
              {selectedCategory?.requiresCandidate && (
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Betroffene Person</label>
                  <select value={fCandidate} onChange={e => setFCandidate(e.target.value)}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Person auswählen...</option>
                    {members.filter(m => m.id !== myId).map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                  </select>
                </div>
              )}

              {/* Prüfung auswählen wenn Kategorie = pruefung */}
              {fCategory === 'pruefung' && (
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Prüfung</label>
                  <select value={fExam} onChange={e => setFExam(e.target.value)}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Prüfung auswählen...</option>
                    {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                  </select>
                </div>
              )}

              {/* Priorität */}
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Priorität</label>
                <div className="flex gap-2">
                  {PRIORITIES.map(p => (
                    <button key={p.key} onClick={() => setFPriority(p.key)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition ${fPriority === p.key ? p.color : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg text-sm transition">Abbrechen</button>
                <button onClick={submitRequest} disabled={saving || !fTitle.trim() || (selectedCategory?.requiresCandidate ? !fCandidate : false)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition">
                  {saving ? 'Wird gestellt...' : '📤 Antrag stellen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL / REVIEW MODAL */}
      {selectedRequest && (() => {
        const r       = selectedRequest;
        const cat     = CATEGORIES.find(c => c.key === r.category);
        const prio    = PRIORITIES.find(p => p.key === r.priority);
        const statusCf = STATUS_CONFIG[r.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
        const isOwn   = r.requested_by === myId;
        const canReview = isManager && !isOwn;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cat?.icon}</span>
                  <div>
                    <h2 className="text-white font-bold">{r.title}</h2>
                    <p className="text-gray-400 text-xs">{cat?.label}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedRequest(null); setReviewResponse(''); }} className="text-gray-400 hover:text-white transition">✕</button>
              </div>
              <div className="p-6 space-y-4">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Antragsteller</p>
                    <p className="text-purple-400 text-sm font-medium">{r.requester?.username}</p>
                  </div>
                  {r.candidate && (
                    <div className="bg-[#0f1117] rounded-lg p-3">
                      <p className="text-gray-500 text-xs mb-1">Betroffene Person</p>
                      <p className="text-blue-400 text-sm font-medium">{r.candidate?.username}</p>
                    </div>
                  )}
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Datum</p>
                    <p className="text-white text-sm">{new Date(r.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Priorität</p>
                    <span className={`text-xs font-medium ${prio?.color}`}>{prio?.label}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className={`text-sm px-3 py-1.5 rounded-lg border font-medium ${statusCf.color}`}>
                    {statusCf.icon} {statusCf.label}
                  </span>
                  {r.reviewer && <span className="text-gray-500 text-xs">von {r.reviewer?.username}</span>}
                </div>

                {/* Beschreibung */}
                {r.description && (
                  <div className="bg-[#0f1117] rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-1">Beschreibung</p>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{r.description}</p>
                  </div>
                )}

                {/* Antwort falls vorhanden */}
                {r.response && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <p className="text-green-400 text-xs font-bold mb-1">📋 Antwort des Managements</p>
                    <p className="text-white text-sm whitespace-pre-wrap">{r.response}</p>
                  </div>
                )}

                {/* Review Actions (nur Manager, nicht eigener Antrag, nur pending) */}
                {canReview && r.status === 'pending' && (
                  <div className="border-t border-white/10 pt-4 space-y-3">
                    <p className="text-white text-sm font-medium">Antrag bearbeiten</p>
                    <textarea value={reviewResponse} onChange={e => setReviewResponse(e.target.value)}
                      placeholder="Antwort / Begründung (optional)..." rows={2}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => reviewRequest(r.id, 'review')} disabled={saving}
                        className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 font-medium py-2.5 rounded-lg text-xs transition disabled:opacity-40">
                        🔍 In Prüfung
                      </button>
                      <button onClick={() => reviewRequest(r.id, 'rejected')} disabled={saving}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium py-2.5 rounded-lg text-xs transition disabled:opacity-40">
                        ❌ Ablehnen
                      </button>
                      <button onClick={() => reviewRequest(r.id, 'approved')} disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-xs transition disabled:opacity-40">
                        ✅ Genehmigen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}