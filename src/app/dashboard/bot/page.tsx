'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BotLog {
  id: string; action: string; moderator_id: string | null; target_id: string | null;
  reason: string | null; details: Record<string, any>; created_at: string;
}
interface TicketCategory {
  label: string; emoji: string; description: string; category_id: string;
  support_roles: string; color: string; message: string;
}

type Section = 'overview' | 'moderation' | 'welcome' | 'leave' | 'tickets' | 'logging' | 'logs' | 'messages';

// ── Constants ─────────────────────────────────────────────────────────────────
const LOGO = 'https://cdn.discordapp.com/attachments/1289620593062187110/1484654302726328440/Hamburg_V2.png';

const LOG_ICONS: Record<string, string> = {
  ban: '🔨', unban: '✅', kick: '👢', timeout: '⏱️', untimeout: '✅', warn: '⚠️',
  clearwarn: '🗑️', chatclear: '🧹', role_add: '➕', role_remove: '➖', lock: '🔒',
  unlock: '🔓', slowmode: '🐌', ticket_open: '🎫', ticket_close: '🔒', ticket_claim: '✋',
  member_join: '📥', member_leave: '📤', message_delete: '🗑️', message_edit: '✏️',
  voice_join: '🔊', voice_leave: '🔇', voice_move: '🔀', nick_change: '✏️',
  member_role_add: '➕', member_role_remove: '➖',
};
const LOG_COLORS: Record<string, string> = {
  ban: 'text-red-400', unban: 'text-green-400', kick: 'text-orange-400',
  timeout: 'text-yellow-400', untimeout: 'text-green-400', warn: 'text-yellow-300',
  clearwarn: 'text-green-300', chatclear: 'text-pink-400', role_add: 'text-cyan-400',
  role_remove: 'text-red-300', lock: 'text-red-400', unlock: 'text-green-400',
  ticket_open: 'text-blue-400', ticket_close: 'text-gray-400', ticket_claim: 'text-teal-400',
  member_join: 'text-green-400', member_leave: 'text-orange-400',
  message_delete: 'text-red-300', message_edit: 'text-yellow-300',
  voice_join: 'text-green-300', voice_leave: 'text-orange-300',
};

const WELCOME_VARS = ['{user}','{username}','{displayname}','{server}','{membercount}','{date}','{time}','{id}','{accountage}','{joined}','{tag}'];

// ── Rich Text Editor ──────────────────────────────────────────────────────────
function RichEditor({ value, onChange, placeholder, rows = 4, label }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; label?: string;
}) {
  return (
    <div>
      {label && <label className="text-gray-400 text-xs font-medium mb-1.5 block">{label}</label>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/70 resize-y font-mono leading-relaxed transition"
      />
      <p className="text-gray-700 text-xs mt-1">Markdown: **fett**, *kursiv*, __unterstrichen__, ~~durchgestrichen~~ · \n für neue Zeile</p>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${value ? 'bg-blue-600' : 'bg-white/10'}`}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
function Input({ label, value, onChange, placeholder, type = 'text', hint }: {
  label?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div>
      {label && <label className="text-gray-400 text-xs font-medium mb-1.5 block">{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/70 transition" />
      {hint && <p className="text-gray-600 text-xs mt-1">{hint}</p>}
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#13151f] border border-white/[0.06] rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BotDashboard() {
  const supabase = createClientSupabaseClient();
  const router   = useRouter();

  const [loading, setLoading]   = useState(true);
  const [guildId, setGuildId]   = useState('');
  const [section, setSection]   = useState<Section>('overview');
  const [configs, setConfigs]   = useState<Record<string, any>>({});
  const [logs, setLogs]         = useState<BotLog[]>([]);
  const [saving, setSaving]     = useState<string | null>(null);
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [logFilter, setLogFilter] = useState('all');

  // Ticket categories
  const [ticketCats, setTicketCats] = useState<TicketCategory[]>([]);

  function showMsg(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  async function load(gid?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/dashboard');
    const { data: p } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    if (!p || p.username !== 'jxkerlds') return router.push('/dashboard');

    const savedGid = gid || localStorage.getItem('bot_guild_id') || '';
    setGuildId(savedGid);

    if (savedGid) {
      const [cfgRes, logsRes] = await Promise.all([
        supabase.from('bot_config').select('*').eq('guild_id', savedGid),
        supabase.from('bot_logs').select('*').eq('guild_id', savedGid).order('created_at', { ascending: false }).limit(200),
      ]);
      const cfgMap: Record<string, any> = {};
      for (const c of cfgRes.data || []) cfgMap[c.module] = c;
      setConfigs(cfgMap);
      setTicketCats(cfgMap['tickets']?.config?.categories || []);
      setLogs(logsRes.data || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getCfg(module: string) { return configs[module]?.config || {}; }
  function isEnabled(module: string) { return configs[module]?.enabled ?? false; }

  async function saveModule(module: string, config: Record<string, any>, enabled?: boolean) {
    if (!guildId) return showMsg('Bitte Guild ID eingeben.', false);
    setSaving(module);
    const en = enabled ?? isEnabled(module);
    await supabase.from('bot_config').upsert({ guild_id: guildId, module, enabled: en, config, updated_at: new Date().toISOString() }, { onConflict: 'guild_id,module' });
    await load(guildId);
    setSaving(null);
    showMsg('✅ Gespeichert!');
  }

  async function toggleModule(module: string) {
    if (!guildId) return showMsg('Bitte Guild ID eingeben.', false);
    const newEnabled = !isEnabled(module);
    await supabase.from('bot_config').upsert({ guild_id: guildId, module, enabled: newEnabled, config: getCfg(module), updated_at: new Date().toISOString() }, { onConflict: 'guild_id,module' });
    await load(guildId);
    showMsg(newEnabled ? `✅ ${module} aktiviert` : `⚫ ${module} deaktiviert`);
  }

  async function saveGuildId() {
    localStorage.setItem('bot_guild_id', guildId);
    await load(guildId);
    showMsg('✅ Verbunden!');
  }

  // Local config state helpers
  const [welcome, setWelcome]     = useState<Record<string,any>>({});
  const [leave, setLeave]         = useState<Record<string,any>>({});
  const [tickets, setTickets]     = useState<Record<string,any>>({});
  const [logging, setLogging]     = useState<Record<string,any>>({});
  const [modCfg, setModCfg]       = useState<Record<string,any>>({});
  const [dmMsgs, setDmMsgs]       = useState<Record<string,any>>({});

  useEffect(() => {
    setWelcome(getCfg('welcome'));
    setLeave(getCfg('leave'));
    setTickets(getCfg('tickets'));
    setLogging(getCfg('logging'));
    setModCfg(getCfg('moderation'));
    setDmMsgs(getCfg('dm_messages'));
    setTicketCats(getCfg('tickets')?.categories || []);
  }, [configs]);

  const filteredLogs = logs.filter(l => logFilter === 'all' || l.action === logFilter || l.action.startsWith(logFilter));
  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

  const NAV: { key: Section; label: string; icon: string; badge?: number }[] = [
    { key: 'overview',   label: 'Übersicht',   icon: '🏠' },
    { key: 'moderation', label: 'Moderation',  icon: '🛡️', badge: isEnabled('moderation') ? undefined : 0 },
    { key: 'welcome',    label: 'Willkommen',  icon: '👋' },
    { key: 'leave',      label: 'Abschied',    icon: '📤' },
    { key: 'tickets',    label: 'Tickets',     icon: '🎫' },
    { key: 'logging',    label: 'Logging',     icon: '📋' },
    { key: 'messages',   label: 'DM Nachrichten', icon: '✉️' },
    { key: 'logs',       label: 'Bot Logs',    icon: '📊', badge: logs.length },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0d0e14] flex items-center justify-center">
      <div className="text-center space-y-4">
        <img src={LOGO} className="w-16 h-16 rounded-2xl mx-auto animate-pulse" />
        <p className="text-gray-400 text-sm">Lade Bot Dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="flex gap-6 max-w-7xl">
      {/* ── Sidebar ── */}
      <div className="w-56 flex-shrink-0">
        <div className="sticky top-6 space-y-1">
          <div className="flex items-center gap-3 px-3 py-4 mb-4">
            <img src={LOGO} className="w-9 h-9 rounded-xl" />
            <div>
              <p className="text-white font-bold text-sm">Hamburg V2</p>
              <p className="text-gray-600 text-xs">Bot Dashboard</p>
            </div>
          </div>
          {NAV.map(n => (
            <button key={n.key} onClick={() => setSection(n.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${section === n.key ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <span>{n.icon}</span>
              <span className="flex-1 text-left">{n.label}</span>
              {n.badge !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${section === n.key ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-gray-500'}`}>
                  {n.badge || '●'}
                </span>
              )}
            </button>
          ))}

          {/* Module Status */}
          <div className="mt-4 px-3 pt-4 border-t border-white/[0.06] space-y-2">
            <p className="text-gray-600 text-xs font-semibold uppercase tracking-wider mb-3">Module</p>
            {['moderation','welcome','leave','tickets','logging'].map(m => (
              <div key={m} className="flex items-center justify-between">
                <span className="text-gray-500 text-xs capitalize">{m}</span>
                <div className={`w-2 h-2 rounded-full ${isEnabled(m) ? 'bg-green-400' : 'bg-gray-700'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Toast */}
        {msg && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium border shadow-2xl ${msg.ok ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
            {msg.text}
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {section === 'overview' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Bot Dashboard</h1>
              <p className="text-gray-500 text-sm mt-1">Verwalte alle Bot-Module · Nur für jxkerlds</p>
            </div>

            {/* Guild ID */}
            <Card>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Discord Server ID</p>
              <div className="flex gap-2">
                <input value={guildId} onChange={e => setGuildId(e.target.value)} placeholder="z.B. 123456789012345678"
                  className="flex-1 bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm font-mono focus:outline-none focus:border-blue-500/70 transition" />
                <button onClick={saveGuildId} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">Verbinden</button>
              </div>
              <p className="text-gray-700 text-xs mt-2">Rechtsklick auf deinen Server → ID kopieren (Entwicklermodus erforderlich)</p>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Bot Logs', value: logs.length, color: 'text-blue-400', border: 'border-blue-500/20' },
                { label: 'Module aktiv', value: ['moderation','welcome','leave','tickets','logging'].filter(m => isEnabled(m)).length, color: 'text-green-400', border: 'border-green-500/20' },
                { label: 'Ticket Kategorien', value: ticketCats.length, color: 'text-purple-400', border: 'border-purple-500/20' },
                { label: 'Heute', value: logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length, color: 'text-yellow-400', border: 'border-yellow-500/20' },
              ].map(s => (
                <Card key={s.label} className={`border ${s.border} text-center`}>
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-500 text-xs mt-1">{s.label}</p>
                </Card>
              ))}
            </div>

            {/* Module Overview */}
            <Card>
              <p className="text-white font-semibold mb-4">🧩 Module</p>
              <div className="space-y-3">
                {[
                  { key: 'moderation', label: 'Moderation', desc: 'Ban, Kick, Timeout, Warn, Chatclear, Lock, Slowmode', icon: '🛡️' },
                  { key: 'welcome',    label: 'Willkommen', desc: 'Willkommensnachrichten mit Embed, Variablen & Auto-Rollen', icon: '👋' },
                  { key: 'leave',      label: 'Abschied',   desc: 'Nachrichten wenn Mitglieder den Server verlassen', icon: '📤' },
                  { key: 'tickets',    label: 'Tickets',    desc: 'Support Ticket System mit Kategorien & Select-Menü', icon: '🎫' },
                  { key: 'logging',    label: 'Logging',    desc: 'Automatisches Logging aller Aktionen in Discord', icon: '📋' },
                ].map(m => (
                  <div key={m.key} className="flex items-center gap-4 bg-[#0d0e14] rounded-xl px-4 py-3">
                    <span className="text-xl flex-shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{m.label}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isEnabled(m.key) ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-500'}`}>
                          {isEnabled(m.key) ? '● Aktiv' : '○ Inaktiv'}
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs mt-0.5">{m.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setSection(m.key as Section)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition">Konfigurieren</button>
                      <Toggle value={isEnabled(m.key)} onChange={() => toggleModule(m.key)} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent Logs */}
            {logs.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white font-semibold">📊 Letzte Aktionen</p>
                  <button onClick={() => setSection('logs')} className="text-blue-400 text-xs hover:text-blue-300">Alle ansehen →</button>
                </div>
                <div className="space-y-2">
                  {logs.slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center gap-3 bg-[#0d0e14] rounded-xl px-4 py-2.5">
                      <span className="text-base flex-shrink-0">{LOG_ICONS[l.action] || '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${LOG_COLORS[l.action] || 'text-gray-300'}`}>
                          {l.action.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        {l.reason && <span className="text-gray-600 text-xs ml-2">{l.reason.substring(0,50)}</span>}
                      </div>
                      <span className="text-gray-700 text-xs flex-shrink-0">{new Date(l.created_at).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── MODERATION ── */}
        {section === 'moderation' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-white">🛡️ Moderation</h2><p className="text-gray-500 text-sm mt-0.5">Ban, Kick, Timeout, Warn & mehr</p></div>
              <Toggle value={isEnabled('moderation')} onChange={() => toggleModule('moderation')} />
            </div>
            <Card>
              <p className="text-gray-400 text-sm mb-4">Das Moderations-Modul aktiviert alle Moderationsbefehle: <span className="font-mono text-gray-300">/ban /kick /timeout /warn /chatclear /lock /slowmode</span> und mehr.</p>
              <div className="grid grid-cols-2 gap-3">
                {['/ban', '/unban', '/kick', '/timeout', '/untimeout', '/warn', '/warnings', '/clearwarn', '/clearallwarns', '/chatclear', '/role', '/lock', '/unlock', '/slowmode'].map(c => (
                  <div key={c} className="bg-[#0d0e14] rounded-lg px-3 py-2 text-gray-400 text-sm font-mono">{c}</div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── WELCOME ── */}
        {section === 'welcome' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-white">👋 Willkommen</h2><p className="text-gray-500 text-sm mt-0.5">Nachrichten wenn neue Mitglieder beitreten</p></div>
              <Toggle value={isEnabled('welcome')} onChange={() => toggleModule('welcome')} />
            </div>
            <Card>
              <div className="space-y-5">
                <Input label="📢 Kanal ID" value={welcome.channel_id || ''} onChange={v => setWelcome(p => ({...p, channel_id: v}))} placeholder="123456789..." hint="ID des Willkommens-Kanals" />
                <Input label="📝 Titel" value={welcome.title || ''} onChange={v => setWelcome(p => ({...p, title: v}))} placeholder="👋 Willkommen auf {server}!" />
                <RichEditor label="💬 Nachricht / Beschreibung" value={welcome.message || ''} onChange={v => setWelcome(p => ({...p, message: v}))} placeholder="Willkommen {user}!\nDu bist Mitglied **#{membercount}**." rows={5} />
                <Input label="🎨 Farbe (Hex)" value={welcome.color || ''} onChange={v => setWelcome(p => ({...p, color: v}))} placeholder="#5865f2" />
                <Input label="🖼️ Banner URL" value={welcome.image || ''} onChange={v => setWelcome(p => ({...p, image: v}))} placeholder="https://..." />
                <Input label="📝 Footer" value={welcome.footer || ''} onChange={v => setWelcome(p => ({...p, footer: v}))} placeholder="Hamburg V2 · {membercount} Mitglieder" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="🏷️ Feld 1 – Name" value={welcome.field_1_name || ''} onChange={v => setWelcome(p => ({...p, field_1_name: v}))} placeholder="📅 Beigetreten" />
                  <Input label="🏷️ Feld 1 – Wert" value={welcome.field_1_value || ''} onChange={v => setWelcome(p => ({...p, field_1_value: v}))} placeholder="{joined}" />
                  <Input label="🏷️ Feld 2 – Name" value={welcome.field_2_name || ''} onChange={v => setWelcome(p => ({...p, field_2_name: v}))} placeholder="📆 Account erstellt" />
                  <Input label="🏷️ Feld 2 – Wert" value={welcome.field_2_value || ''} onChange={v => setWelcome(p => ({...p, field_2_value: v}))} placeholder="{accountage}" />
                  <Input label="🏷️ Feld 3 – Name" value={welcome.field_3_name || ''} onChange={v => setWelcome(p => ({...p, field_3_name: v}))} placeholder="🆔 ID" />
                  <Input label="🏷️ Feld 3 – Wert" value={welcome.field_3_value || ''} onChange={v => setWelcome(p => ({...p, field_3_value: v}))} placeholder="{id}" />
                </div>
                <Input label="🎭 Auto-Rollen IDs (kommagetrennt)" value={welcome.auto_role || ''} onChange={v => setWelcome(p => ({...p, auto_role: v}))} placeholder="123456789, 987654321" hint="Rollen die automatisch beim Beitritt vergeben werden" />
                <RichEditor label="📨 DM Nachricht (optional)" value={welcome.dm_message || ''} onChange={v => setWelcome(p => ({...p, dm_message: v}))} placeholder="Willkommen auf {server}, {username}! ..." rows={3} />
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer"><Toggle value={!!welcome.embed} onChange={v => setWelcome(p => ({...p, embed: v}))} /><span className="text-gray-300 text-sm">Als Embed senden</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><Toggle value={!!welcome.thumbnail} onChange={v => setWelcome(p => ({...p, thumbnail: v}))} /><span className="text-gray-300 text-sm">Avatar als Thumbnail</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><Toggle value={!!welcome.ping_user} onChange={v => setWelcome(p => ({...p, ping_user: v}))} /><span className="text-gray-300 text-sm">Benutzer pingen</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><Toggle value={!!welcome.show_logo} onChange={v => setWelcome(p => ({...p, show_logo: v}))} /><span className="text-gray-300 text-sm">Logo im Author</span></label>
                </div>

                {/* Variables */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-400 text-xs font-semibold mb-3">📝 Verfügbare Variablen</p>
                  <div className="flex flex-wrap gap-2">
                    {WELCOME_VARS.map(v => (
                      <span key={v} className="text-blue-300 text-xs font-mono bg-blue-500/20 px-2 py-1 rounded-lg cursor-pointer hover:bg-blue-500/30 transition" title={`Klicke um ${v} zu kopieren`} onClick={() => navigator.clipboard.writeText(v)}>{v}</span>
                    ))}
                  </div>
                  <p className="text-gray-600 text-xs mt-2">Klicke auf eine Variable um sie zu kopieren · \\n für neue Zeile · **fett** *kursiv*</p>
                </div>
              </div>
              <button onClick={() => saveModule('welcome', welcome)} disabled={saving === 'welcome'}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
                {saving === 'welcome' ? '⏳ Speichern...' : '💾 Willkommen speichern'}
              </button>
            </Card>
          </div>
        )}

        {/* ── LEAVE ── */}
        {section === 'leave' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-white">📤 Abschied</h2><p className="text-gray-500 text-sm mt-0.5">Nachrichten wenn Mitglieder den Server verlassen</p></div>
              <Toggle value={isEnabled('leave')} onChange={() => toggleModule('leave')} />
            </div>
            <Card>
              <div className="space-y-5">
                <Input label="📢 Kanal ID" value={leave.channel_id || ''} onChange={v => setLeave(p => ({...p, channel_id: v}))} placeholder="123456789..." />
                <Input label="📝 Titel" value={leave.title || ''} onChange={v => setLeave(p => ({...p, title: v}))} placeholder="👋 Auf Wiedersehen!" />
                <RichEditor label="💬 Nachricht" value={leave.message || ''} onChange={v => setLeave(p => ({...p, message: v}))} placeholder="**{username}** hat den Server verlassen.\nWir waren **{membercount}** Mitglieder." rows={4} />
                <Input label="🎨 Farbe (Hex)" value={leave.color || ''} onChange={v => setLeave(p => ({...p, color: v}))} placeholder="#ff4444" />
                <Input label="📝 Footer" value={leave.footer || ''} onChange={v => setLeave(p => ({...p, footer: v}))} placeholder="Hamburg V2" />
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer"><Toggle value={leave.embed !== false} onChange={v => setLeave(p => ({...p, embed: v}))} /><span className="text-gray-300 text-sm">Als Embed senden</span></label>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-400 text-xs font-semibold mb-2">📝 Variablen</p>
                  <div className="flex flex-wrap gap-2">{WELCOME_VARS.map(v => <span key={v} className="text-blue-300 text-xs font-mono bg-blue-500/20 px-2 py-1 rounded-lg">{v}</span>)}</div>
                </div>
              </div>
              <button onClick={() => saveModule('leave', leave)} disabled={saving === 'leave'}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
                {saving === 'leave' ? '⏳ Speichern...' : '💾 Abschied speichern'}
              </button>
            </Card>
          </div>
        )}

        {/* ── TICKETS ── */}
        {section === 'tickets' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-white">🎫 Ticket System</h2><p className="text-gray-500 text-sm mt-0.5">Support Tickets mit Kategorien</p></div>
              <Toggle value={isEnabled('tickets')} onChange={() => toggleModule('tickets')} />
            </div>

            {/* Global Settings */}
            <Card>
              <p className="text-white font-semibold mb-5">⚙️ Globale Einstellungen</p>
              <div className="space-y-4">
                <Input label="📝 Panel Titel" value={tickets.panel_title || ''} onChange={v => setTickets(p => ({...p, panel_title: v}))} placeholder="🎫 Support Ticket" />
                <RichEditor label="💬 Panel Beschreibung" value={tickets.panel_description || ''} onChange={v => setTickets(p => ({...p, panel_description: v}))} placeholder="Wähle eine Kategorie um ein Ticket zu erstellen.\n\n**Regeln:**\n• Sei respektvoll\n• Beschreibe dein Problem genau" rows={6} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="🎨 Farbe (Hex)" value={tickets.color || ''} onChange={v => setTickets(p => ({...p, color: v}))} placeholder="#5865f2" />
                  <Input label="📁 Select Platzhalter" value={tickets.select_placeholder || ''} onChange={v => setTickets(p => ({...p, select_placeholder: v}))} placeholder="📁 Kategorie wählen..." />
                  <Input label="🖼️ Panel Banner URL" value={tickets.panel_image || ''} onChange={v => setTickets(p => ({...p, panel_image: v}))} placeholder="https://..." />
                  <Input label="🖼️ Panel Thumbnail URL" value={tickets.panel_thumbnail || ''} onChange={v => setTickets(p => ({...p, panel_thumbnail: v}))} placeholder="https://..." />
                  <Input label="📝 Footer" value={tickets.footer || ''} onChange={v => setTickets(p => ({...p, footer: v}))} placeholder="Hamburg V2 Support" />
                  <Input label="📢 Standard Kategorie ID" value={tickets.category_id || ''} onChange={v => setTickets(p => ({...p, category_id: v}))} placeholder="123456789..." />
                  <Input label="🎭 Support Rollen IDs (kommagetrennt)" value={tickets.support_roles || ''} onChange={v => setTickets(p => ({...p, support_roles: v}))} placeholder="123456789, 987654321" />
                  <Input label="💬 Einfacher Button Text" value={tickets.button_label || ''} onChange={v => setTickets(p => ({...p, button_label: v}))} placeholder="📩 Ticket erstellen" />
                </div>
                <RichEditor label="📨 Standard Ticket Nachricht" value={tickets.ticket_message || ''} onChange={v => setTickets(p => ({...p, ticket_message: v}))} placeholder="Hallo {user}!\n\nDas Support-Team wird sich **bald** bei dir melden.\nBitte beschreibe dein Anliegen so genau wie möglich." rows={5} />
              </div>
            </Card>

            {/* Categories */}
            <Card>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-white font-semibold">📁 Kategorien</p>
                  <p className="text-gray-600 text-xs mt-0.5">Bis zu 25 Kategorien · erscheinen als Select-Menü</p>
                </div>
                <button onClick={() => setTicketCats(p => [...p, { label: 'Neue Kategorie', emoji: '🎫', description: '', category_id: '', support_roles: '', color: '#5865f2', message: '' }])}
                  className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-4 py-2 rounded-xl transition">
                  + Kategorie hinzufügen
                </button>
              </div>

              {ticketCats.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
                  <p className="text-4xl mb-3">📁</p>
                  <p className="text-gray-500 text-sm">Keine Kategorien – ohne Kategorien erscheint ein einfacher Button</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ticketCats.map((cat, idx) => (
                    <div key={idx} className="bg-[#0d0e14] border border-white/[0.06] rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{cat.emoji || '🎫'}</span>
                          <span className="text-white font-medium text-sm">{cat.label || `Kategorie ${idx+1}`}</span>
                          <span className="text-gray-600 text-xs">#{idx+1}</span>
                        </div>
                        <div className="flex gap-2">
                          {idx > 0 && <button onClick={() => { const n = [...ticketCats]; [n[idx],n[idx-1]] = [n[idx-1],n[idx]]; setTicketCats(n); }} className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded transition">↑</button>}
                          {idx < ticketCats.length-1 && <button onClick={() => { const n = [...ticketCats]; [n[idx],n[idx+1]] = [n[idx+1],n[idx]]; setTicketCats(n); }} className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded transition">↓</button>}
                          <button onClick={() => setTicketCats(p => p.filter((_,i) => i !== idx))} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded transition">✕</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'label', label: 'Name', placeholder: 'Allgemeiner Support' },
                          { key: 'emoji', label: 'Emoji', placeholder: '🎫' },
                          { key: 'description', label: 'Kurzbeschreibung', placeholder: 'Allgemeine Fragen & Probleme' },
                          { key: 'color', label: 'Farbe (Hex)', placeholder: '#5865f2' },
                          { key: 'category_id', label: 'Kategorie ID', placeholder: '123456789...' },
                          { key: 'support_roles', label: 'Support Rollen IDs', placeholder: '123456789, 987654321' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="text-gray-500 text-xs mb-1 block">{f.label}</label>
                            <input value={(cat as any)[f.key] || ''} onChange={e => { const n = [...ticketCats]; (n[idx] as any)[f.key] = e.target.value; setTicketCats(n); }} placeholder={f.placeholder}
                              className="w-full bg-[#13151f] border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-gray-700 text-sm focus:outline-none focus:border-blue-500/50 transition" />
                          </div>
                        ))}
                        <div className="col-span-2">
                          <label className="text-gray-500 text-xs mb-1 block">Ticket Nachricht</label>
                          <textarea value={cat.message || ''} onChange={e => { const n = [...ticketCats]; n[idx].message = e.target.value; setTicketCats(n); }}
                            placeholder="Hallo {user}!\n\nDanke für dein Ticket in der Kategorie **{category}**.\nDas Team meldet sich bald." rows={3}
                            className="w-full bg-[#13151f] border border-white/[0.06] rounded-xl px-3 py-2 text-white placeholder-gray-700 text-sm focus:outline-none focus:border-blue-500/50 resize-none font-mono transition" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <button onClick={() => saveModule('tickets', { ...tickets, categories: ticketCats })} disabled={saving === 'tickets'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
              {saving === 'tickets' ? '⏳ Speichern...' : '💾 Ticket System speichern'}
            </button>
          </div>
        )}

        {/* ── LOGGING ── */}
        {section === 'logging' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-white">📋 Logging</h2><p className="text-gray-500 text-sm mt-0.5">Automatisches Logging aller Aktionen</p></div>
              <Toggle value={isEnabled('logging')} onChange={() => toggleModule('logging')} />
            </div>
            <Card>
              <p className="text-gray-400 text-sm mb-5">Lasse alle Bot-Aktionen automatisch in Discord-Kanäle loggen. Konfiguriere einen Haupt-Kanal oder spezifische Kanäle pro Kategorie.</p>
              <div className="space-y-4">
                <Input label="📢 Haupt-Log Kanal ID" value={logging.channel_id || ''} onChange={v => setLogging(p => ({...p, channel_id: v}))} placeholder="123456789..." hint="Wird verwendet wenn kein spezifischer Kanal gesetzt ist" />
                <div className="border-t border-white/[0.06] pt-4">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Spezifische Kanäle (optional)</p>
                  <div className="space-y-3">
                    {[
                      { key: 'mod_channel',    label: '🛡️ Moderations-Logs',    hint: 'Ban, Kick, Timeout, Warn' },
                      { key: 'member_channel', label: '👤 Mitglieder-Logs',     hint: 'Join, Leave, Nickname, Rollen' },
                      { key: 'msg_channel',    label: '💬 Nachrichten-Logs',    hint: 'Gelöscht, Bearbeitet' },
                      { key: 'voice_channel',  label: '🔊 Voice-Logs',          hint: 'Join, Leave, Move' },
                      { key: 'ticket_channel', label: '🎫 Ticket-Logs',         hint: 'Geöffnet, Geschlossen, Claimed' },
                    ].map(f => (
                      <div key={f.key} className="flex items-center gap-3">
                        <div className="w-44 flex-shrink-0">
                          <p className="text-gray-300 text-sm">{f.label}</p>
                          <p className="text-gray-600 text-xs">{f.hint}</p>
                        </div>
                        <input value={(logging as any)[f.key] || ''} onChange={e => setLogging(p => ({...p, [f.key]: e.target.value}))} placeholder="Kanal ID..."
                          className="flex-1 bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-700 text-sm focus:outline-none focus:border-blue-500/50 font-mono transition" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => saveModule('logging', logging)} disabled={saving === 'logging'}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
                {saving === 'logging' ? '⏳ Speichern...' : '💾 Logging speichern'}
              </button>
            </Card>
          </div>
        )}

        {/* ── LOGS ── */}
        {/* ── DM NACHRICHTEN ── */}
        {section === 'messages' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">✉️ DM Nachrichten</h2>
              <p className="text-gray-500 text-sm mt-0.5">Nachrichten die Benutzer per DM erhalten · Variablen: {'{reason}'} {'{duration}'} {'{server}'} {'{moderator}'}</p>
            </div>
            <Card>
              <div className="space-y-6">
                {[
                  { key: 'ban',       label: '🔨 Ban DM',          placeholder: 'Du wurdest von **{server}** gebannt.\n\n**Grund:** {reason}' },
                  { key: 'kick',      label: '👢 Kick DM',         placeholder: 'Du wurdest von **{server}** gekickt.\n\n**Grund:** {reason}' },
                  { key: 'timeout',   label: '⏱️ Timeout DM',     placeholder: 'Du hast einen Timeout auf **{server}** erhalten.\n\n**Dauer:** {duration} Minuten\n**Grund:** {reason}' },
                  { key: 'untimeout', label: '✅ Timeout Ende DM', placeholder: 'Dein Timeout auf **{server}** wurde aufgehoben.' },
                  { key: 'warn',      label: '⚠️ Warn DM',        placeholder: 'Du hast eine Verwarnung auf **{server}** erhalten.\n\n**Grund:** {reason}' },
                ].map(f => (
                  <div key={f.key}>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-gray-300 text-sm font-medium">{f.label}</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Toggle value={dmMsgs[f.key + '_enabled'] !== false} onChange={v => setDmMsgs(p => ({...p, [f.key + '_enabled']: v}))} />
                        <span className="text-gray-500 text-xs">Aktiviert</span>
                      </label>
                    </div>
                    <RichEditor value={dmMsgs[f.key] || ''} onChange={v => setDmMsgs(p => ({...p, [f.key]: v}))} placeholder={f.placeholder} rows={4} />
                  </div>
                ))}
              </div>
              <button onClick={() => saveModule('dm_messages', dmMsgs)} disabled={saving === 'dm_messages'}
                className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
                {saving === 'dm_messages' ? '⏳ Speichern...' : '💾 DM Nachrichten speichern'}
              </button>
            </Card>
          </div>
        )}
        {section === 'logs' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-white">📊 Bot Logs</h2><p className="text-gray-500 text-sm mt-0.5">{logs.length} Einträge gesamt</p></div>
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setLogFilter('all')} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${logFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>Alle ({logs.length})</button>
              {[
                { key: 'ban', label: '🔨 Bans' }, { key: 'kick', label: '👢 Kicks' },
                { key: 'timeout', label: '⏱️ Timeouts' }, { key: 'warn', label: '⚠️ Warns' },
                { key: 'ticket', label: '🎫 Tickets' }, { key: 'member', label: '👤 Mitglieder' },
                { key: 'message', label: '💬 Nachrichten' }, { key: 'voice', label: '🔊 Voice' },
              ].map(f => (
                <button key={f.key} onClick={() => setLogFilter(f.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${logFilter === f.key ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                  {f.label} ({logs.filter(l => l.action.startsWith(f.key)).length})
                </button>
              ))}
            </div>

            {/* Log List */}
            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-gray-500 text-sm">Keine Logs vorhanden</p>
                </Card>
              ) : filteredLogs.map(l => (
                <div key={l.id} className="bg-[#13151f] border border-white/[0.05] rounded-2xl px-5 py-3.5 hover:border-white/10 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="text-lg flex-shrink-0 mt-0.5">{LOG_ICONS[l.action] || '📋'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${LOG_COLORS[l.action] || 'text-gray-300'}`}>
                            {l.action.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                          {l.moderator_id && <span className="text-blue-400/70 text-xs font-mono">{l.moderator_id.slice(0,8)}...</span>}
                          {l.target_id    && <><span className="text-gray-700">→</span><span className="text-purple-400/70 text-xs font-mono">{l.target_id.slice(0,8)}...</span></>}
                        </div>
                        {l.reason && <p className="text-gray-500 text-xs mt-0.5 truncate">{l.reason}</p>}
                        {l.details && Object.keys(l.details).length > 0 && (
                          <div className="flex gap-2 flex-wrap mt-1">
                            {Object.entries(l.details).slice(0, 3).map(([k, v]) => (
                              <span key={k} className="text-gray-700 text-xs bg-white/[0.03] px-2 py-0.5 rounded-lg font-mono">{k}: {String(v).substring(0,30)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-700 text-xs flex-shrink-0 mt-1">
                      {new Date(l.created_at).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}