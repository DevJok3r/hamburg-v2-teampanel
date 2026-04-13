'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can, ROLE_LABELS } from '@/lib/permissions';

interface Conference {
  id: string;
  title: string;
  description?: string;
  scheduled_at: string;
  created_by: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  created_at: string;
  creator?: { username: string; role: UserRole };
}

export default function ConferencesPage() {
  const supabase = createClientSupabaseClient();
  const [myId, setMyId]         = useState('');
  const [myRole, setMyRole]     = useState<UserRole | null>(null);
  const [confs, setConfs]       = useState<Conference[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [date, setDate]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (p) setMyRole(p.role as UserRole);
    const { data } = await supabase.from('conferences')
      .select('*, creator:created_by(username, role)')
      .order('scheduled_at', { ascending: true });
    setConfs(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createConf() {
    if (!title.trim() || !date) { setError('Titel und Datum erforderlich.'); return; }
    setSaving(true); setError('');
    await supabase.from('conferences').insert({ title: title.trim(), description: desc.trim() || null, scheduled_at: date, created_by: myId, status: 'scheduled' });
    setTitle(''); setDesc(''); setDate(''); setShowNew(false);
    await load();
    setSaving(false);
  }

  async function updateStatus(id: string, status: Conference['status']) {
    await supabase.from('conferences').update({ status }).eq('id', id);
    await load();
  }

  const STATUS_LABEL: Record<Conference['status'], string> = {
    scheduled: '📅 Geplant', active: '🟢 Aktiv', ended: '✅ Beendet', cancelled: '❌ Abgesagt',
  };
  const STATUS_COLOR: Record<Conference['status'], string> = {
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    active:    'bg-green-500/10 text-green-400 border-green-500/20',
    ended:     'bg-gray-500/10 text-gray-500 border-gray-500/20',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  const canManage = myRole ? can.manageConferences(myRole) : false;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Konferenzen</h1>
          <p className="text-gray-500 text-sm mt-1">Meetings & Sitzungen</p>
        </div>
        {canManage && (
          <button onClick={() => setShowNew(v => !v)}
            className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
            + Neue Konferenz
          </button>
        )}
      </div>

      {showNew && (
        <div className="bg-[#13151f] border border-purple-500/20 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold">Neue Konferenz erstellen</h2>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel *"
            className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/70" />
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Beschreibung (optional)" rows={3}
            className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/70 resize-none" />
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/70" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="bg-white/5 hover:bg-white/10 text-gray-400 px-4 py-2 rounded-xl text-sm transition">Abbrechen</button>
            <button onClick={createConf} disabled={saving} className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-xl text-sm transition">
              {saving ? 'Erstellen...' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {confs.length === 0 ? (
          <div className="bg-[#13151f] border border-white/[0.06] rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-gray-500 text-sm">Keine Konferenzen geplant.</p>
          </div>
        ) : confs.map(c => (
          <div key={c.id} className="bg-[#13151f] border border-white/[0.06] hover:border-white/10 rounded-2xl p-5 transition">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-white font-semibold">{c.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${STATUS_COLOR[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                </div>
                {c.description && <p className="text-gray-500 text-sm mb-2">{c.description}</p>}
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span>📅 {new Date(c.scheduled_at).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {c.creator && <span>👤 {c.creator.username}</span>}
                </div>
              </div>
              {canManage && (
                <select value={c.status} onChange={e => updateStatus(c.id, e.target.value as Conference['status'])}
                  className="bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500/50 flex-shrink-0">
                  <option value="scheduled">Geplant</option>
                  <option value="active">Aktiv</option>
                  <option value="ended">Beendet</option>
                  <option value="cancelled">Abgesagt</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
