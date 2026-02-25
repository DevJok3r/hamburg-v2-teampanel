'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { isStaff } from '@/lib/permissions';
import { useRouter } from 'next/navigation';

type Platform = 'discord' | 'ingame';
type LogType = 'warn' | 'mute' | 'kick' | 'ban' | 'report' | 'other';

interface ModLog {
  id: string;
  platform: Platform;
  log_type: LogType;
  roblox_name: string | null;
  roblox_id: string | null;
  discord_name: string | null;
  discord_id: string | null;
  reason: string;
  duration: string | null;
  expires_at: string | null;
  notes: string | null;
  moderator_id: string;
  created_at: string;
  profiles?: { username: string };
}

const PLATFORM_STYLES: Record<Platform, string> = {
  discord: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  ingame:  'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
};
const PLATFORM_LABELS: Record<Platform, string> = {
  discord: '💬 Discord',
  ingame:  '🎮 Ingame',
};

const LOG_TYPE_STYLES: Record<LogType, string> = {
  warn:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  mute:   'bg-orange-500/10 text-orange-400 border-orange-500/30',
  kick:   'bg-red-500/10 text-red-400 border-red-500/30',
  ban:    'bg-red-700/10 text-red-500 border-red-700/30',
  report: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  other:  'bg-gray-500/10 text-gray-400 border-gray-500/30',
};
const LOG_TYPE_LABELS: Record<LogType, string> = {
  warn: 'Verwarnung', mute: 'Mute', kick: 'Kick', ban: 'Ban', report: 'Report', other: 'Sonstiges',
};

// Welche Felder für welchen Typ benötigt werden
const TYPE_CONFIG: Record<LogType, {
  needsDuration: boolean;
  needsExpiry: boolean;
  label: string;
  icon: string;
}> = {
  warn:   { needsDuration: false, needsExpiry: true,  label: 'Verwarnung',  icon: '⚠️' },
  mute:   { needsDuration: true,  needsExpiry: true,  label: 'Mute',        icon: '🔇' },
  kick:   { needsDuration: false, needsExpiry: false, label: 'Kick',        icon: '👢' },
  ban:    { needsDuration: true,  needsExpiry: true,  label: 'Ban',         icon: '🔨' },
  report: { needsDuration: false, needsExpiry: false, label: 'Report',      icon: '📋' },
  other:  { needsDuration: false, needsExpiry: false, label: 'Sonstiges',   icon: '📝' },
};

const emptyForm = {
  platform: '' as Platform | '',
  log_type: '' as LogType | '',
  roblox_name: '', roblox_id: '',
  discord_name: '', discord_id: '',
  reason: '', duration: '', expires_at: '', notes: '',
};

export default function ModLogsPage() {
  const [logs, setLogs]               = useState<ModLog[]>([]);
  const [myRole, setMyRole]           = useState<UserRole | null>(null);
  const [myId, setMyId]               = useState<string>('');
  const [myUsername, setMyUsername]   = useState<string>('');
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(emptyForm);
  const [selectedLog, setSelectedLog] = useState<ModLog | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterType, setFilterType]         = useState<string>('all');
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
    const role = profile.role as UserRole;
    const canAccess = isStaff(role) || role.includes('moderator');
    if (!profile || !canAccess) { router.push('/dashboard'); return; }
    const canDelete = role === 'top_management';
    setMyRole(profile.role as UserRole);
    setMyUsername(profile.username);
    const { data } = await supabase
      .from('mod_logs')
      .select('*, profiles!mod_logs_moderator_id_fkey(username)')
      .order('created_at', { ascending: false });
    setLogs(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!form.platform || !form.log_type || !form.reason.trim()) return;
    await supabase.from('mod_logs').insert({
      platform:     form.platform,
      log_type:     form.log_type,
      roblox_name:  form.roblox_name || null,
      roblox_id:    form.roblox_id || null,
      discord_name: form.discord_name || null,
      discord_id:   form.discord_id || null,
      reason:       form.reason,
      duration:     form.duration || null,
      expires_at:   form.expires_at || null,
      notes:        form.notes || null,
      moderator_id: myId,
    });
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  async function deleteLog(id: string) {
    await supabase.from('mod_logs').delete().eq('id', id);
    setSelectedLog(null);
    load();
  }

  const filtered = logs.filter(l =>
    (filterPlatform === 'all' || l.platform === filterPlatform) &&
    (filterType === 'all' || l.log_type === filterType)
  );

  const config = form.log_type ? TYPE_CONFIG[form.log_type as LogType] : null;

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Moderations-Log</h1>
          <p className="text-gray-400 text-sm mt-1">{logs.length} Einträge gesamt</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setForm(emptyForm); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Eintrag
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {(Object.keys(LOG_TYPE_LABELS) as LogType[]).map(t => (
          <div key={t} className={`rounded-xl p-3 border text-center ${LOG_TYPE_STYLES[t]}`}>
            <p className="text-lg font-bold">{logs.filter(l => l.log_type === t).length}</p>
            <p className="text-xs mt-0.5">{LOG_TYPE_LABELS[t]}</p>
          </div>
        ))}
      </div>

      {/* Formular */}
      {showForm && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 space-y-5">
          <h3 className="text-white font-bold text-lg">Neuer Moderations-Eintrag</h3>

          {/* Schritt 1: Platform */}
          <div>
            <label className="text-gray-400 text-xs mb-2 block">1. Plattform auswählen *</label>
            <div className="flex gap-3">
              {(['discord', 'ingame'] as Platform[]).map(p => (
                <button key={p} type="button" onClick={() => setForm(f => ({ ...f, platform: p, log_type: '' }))}
                  className={`flex-1 py-3 rounded-xl font-medium border transition text-sm
                    ${form.platform === p ? PLATFORM_STYLES[p] : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Schritt 2: Typ */}
          {form.platform && (
            <div>
              <label className="text-gray-400 text-xs mb-2 block">2. Art des Eintrags *</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(TYPE_CONFIG) as LogType[]).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, log_type: t }))}
                    className={`py-2.5 rounded-lg font-medium border transition text-sm
                      ${form.log_type === t ? LOG_TYPE_STYLES[t] : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>
                    {TYPE_CONFIG[t].icon} {TYPE_CONFIG[t].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schritt 3: Spielerdaten */}
          {form.platform && form.log_type && (
            <>
              <div>
                <label className="text-gray-400 text-xs mb-2 block">3. Spielerdaten</label>
                <div className="grid grid-cols-2 gap-3">
                  {(form.platform === 'ingame' || form.platform === 'discord') && (
                    <>
                      <div>
                        <label className="text-gray-500 text-xs mb-1 block">Roblox Name</label>
                        <input value={form.roblox_name} onChange={e => setForm(f => ({ ...f, roblox_name: e.target.value }))}
                          placeholder="Roblox Benutzername..."
                          className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs mb-1 block">Roblox ID</label>
                        <input value={form.roblox_id} onChange={e => setForm(f => ({ ...f, roblox_id: e.target.value }))}
                          placeholder="Roblox User ID..."
                          className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs mb-1 block">Discord Name</label>
                        <input value={form.discord_name} onChange={e => setForm(f => ({ ...f, discord_name: e.target.value }))}
                          placeholder="Discord Benutzername..."
                          className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                      <div>
                        <label className="text-gray-500 text-xs mb-1 block">Discord ID</label>
                        <input value={form.discord_id} onChange={e => setForm(f => ({ ...f, discord_id: e.target.value }))}
                          placeholder="Discord User ID..."
                          className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Schritt 4: Grund & Details */}
              <div className="space-y-3">
                <label className="text-gray-400 text-xs block">4. Details *</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Grund / Beschreibung des Vorfalls..." rows={3}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />

                {config?.needsDuration && (
                  <input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                    placeholder="Dauer (z.B. 7 Tage, Permanent)..."
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                )}

                {config?.needsExpiry && (
                  <input value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                    placeholder="Ablaufdatum (z.B. 01.03.2026)..."
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                )}

                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Zusätzliche Notizen (optional)..." rows={2}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 font-medium px-4 py-2 rounded-lg transition text-sm">
                  Abbrechen
                </button>
                <button onClick={submit} disabled={!form.reason.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg transition text-sm">
                  Eintrag speichern
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded border font-medium ${PLATFORM_STYLES[selectedLog.platform]}`}>
                  {PLATFORM_LABELS[selectedLog.platform]}
                </span>
                <span className={`text-xs px-2 py-1 rounded border font-medium ${LOG_TYPE_STYLES[selectedLog.log_type]}`}>
                  {TYPE_CONFIG[selectedLog.log_type].icon} {LOG_TYPE_LABELS[selectedLog.log_type]}
                </span>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {selectedLog.roblox_name && (
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Roblox Name</p>
                    <p className="text-white text-sm">{selectedLog.roblox_name}</p>
                  </div>
                )}
                {selectedLog.roblox_id && (
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Roblox ID</p>
                    <p className="text-white text-sm">{selectedLog.roblox_id}</p>
                  </div>
                )}
                {selectedLog.discord_name && (
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Discord Name</p>
                    <p className="text-white text-sm">{selectedLog.discord_name}</p>
                  </div>
                )}
                {selectedLog.discord_id && (
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Discord ID</p>
                    <p className="text-white text-sm">{selectedLog.discord_id}</p>
                  </div>
                )}
                {selectedLog.duration && (
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Dauer</p>
                    <p className="text-white text-sm">{selectedLog.duration}</p>
                  </div>
                )}
                {selectedLog.expires_at && (
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Ablaufdatum</p>
                    <p className="text-white text-sm">{selectedLog.expires_at}</p>
                  </div>
                )}
              </div>
              <div className="bg-[#0f1117] rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Grund</p>
                <p className="text-white text-sm whitespace-pre-wrap">{selectedLog.reason}</p>
              </div>
              {selectedLog.notes && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Notizen</p>
                  <p className="text-white text-sm whitespace-pre-wrap">{selectedLog.notes}</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-gray-500 text-xs">Eingetragen von <span className="text-gray-400">{(selectedLog.profiles as any)?.username}</span></p>
                  <p className="text-gray-600 text-xs">{new Date(selectedLog.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                  {myRole === 'top_management' && (
                  <button onClick={() => deleteLog(selectedLog.id)}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                    Löschen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'discord', 'ingame'] as const).map(p => (
          <button key={p} onClick={() => setFilterPlatform(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterPlatform === p ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            {p === 'all' ? 'Alle Plattformen' : PLATFORM_LABELS[p as Platform]}
          </button>
        ))}
        {(['all', ...Object.keys(LOG_TYPE_LABELS)] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterType === t ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            {t === 'all' ? 'Alle Typen' : LOG_TYPE_LABELS[t as LogType]}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Keine Einträge vorhanden</div>
        ) : filtered.map(log => (
          <div key={log.id} onClick={() => setSelectedLog(log)}
            className="bg-[#1a1d27] border border-white/10 hover:border-blue-500/30 rounded-xl px-5 py-4 cursor-pointer transition">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl">{TYPE_CONFIG[log.log_type].icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium text-sm">
                      {log.roblox_name || log.discord_name || 'Unbekannt'}
                    </p>
                    {log.roblox_id && <span className="text-gray-600 text-xs">ID: {log.roblox_id}</span>}
                  </div>
                  <p className="text-gray-500 text-xs truncate mt-0.5">{log.reason}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded border ${PLATFORM_STYLES[log.platform]}`}>
                  {PLATFORM_LABELS[log.platform]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded border ${LOG_TYPE_STYLES[log.log_type]}`}>
                  {LOG_TYPE_LABELS[log.log_type]}
                </span>
                <span className="text-gray-600 text-xs">{new Date(log.created_at).toLocaleDateString('de-DE')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}